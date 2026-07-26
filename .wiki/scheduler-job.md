# pure-vapor Scheduler / Job 机制详解

本文基于 `packages/pure-vapor/src/internal/scheduler.js` 与 `packages/pure-vapor/src/vapor/renderEffect.js`，说明调度器为何存在、如何工作，以及更新顺序、生命周期时序、递归控制、标志位与 `nextTick` 的细节。

---

## 1. Scheduler 的作用

响应式系统负责回答：**“谁脏了、何时 notify”**。  
Scheduler 负责回答：**“何时跑、跑几次、按什么顺序跑、跑完后做什么”**。

在 vapor 中，模板被拆成多个细粒度 `renderEffect`（文本、属性、`if`/`for`、子组件 props 等）。若在依赖变更时同步立刻执行 effect，会出现：

- 同一 tick 内多次赋值导致重复写 DOM
- 父子组件 / 同组件多个 effect 执行顺序不可控
- `mounted` / `updated` / `nextTick` 等“DOM 已稳定”的假设被破坏
- 组件已卸载后，仍执行尚未 flush 的挂载回调

因此变更路径是异步批处理，而不是同步直跑：

```
dep 变更
  → RenderEffect.notify()
  → queueJob(job)
  → microtask flushJobs()
  → job() → effect.run() → 写 DOM
  → flushPostFlushCbs()  // mounted / updated / ref 等
```

---

## 2. 原理概览

### 2.1 两套队列

| 队列 | 入队 API | 典型用途 |
|------|----------|----------|
| **jobs**（主队列） | `queueJob` | `renderEffect` 更新、默认 `watch`（flush: `'pre'`） |
| **postJobs**（后置队列） | `queuePostFlushCb` | `mounted` / `updated` / `unmounted`、Teleport 挂载、Transition enter、templateRef、KeepAlive、cssVars 等 |

一轮 flush 的顺序固定为：

1. 按 `order` 执行主队列 `jobs`
2. 再执行后置队列 `postJobs`
3. 若执行过程中又产生了新 job / post job，则递归再 flush 一轮

### 2.2 异步调度（microtask）

```js
function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(doFlushJobs)
  }
}
```

第一次入队时，用 `Promise.resolve().then(...)` 挂起一次 microtask。同一同步代码块里后续的 `queueJob` / `queuePostFlushCb` 只会往队列追加，不会重复安排 flush。

### 2.3 去重

`queueJobWorker` 在入队前检查 `QUEUED` 标志：已在队列中的 job 不会再次插入。因此：

```js
count.value++
count.value++
count.value++
```

只会让对应 `renderEffect` 的 job **入队一次**，flush 时最多执行一轮实际 DOM 更新（且 job 内部还会看 `this.dirty`）。

### 2.4 与 renderEffect 的衔接

```js
// RenderEffect.notify
queueJob(this.job, this.i ? this.i.uid : undefined, false, this.order)

// job 本体
const job = () => {
  if (this.dirty) {
    this.run()
  }
}
```

响应式侧把 effect 标脏并 `notify`；真正执行被推迟到 scheduler。

---

## 3. 如何保证更新顺序（父子 / 同组件内）

### 3.1 order 计算公式

`queueJob(job, id, isPre = false, order = 0)` 把入参编码成一个可比较的数字 `job.order`：

| 场景 | order |
|------|--------|
| 无 `id` 且 `isPre` | `-2` |
| 无 `id` 且非 pre | `Infinity` |
| 有 `id` 且 `isPre` | `id * 2`（偶数） |
| 有 `id`、非 pre、`order === 0` | `id * 2 + 1`（奇数） |
| 有 `id`、非 pre、`order > 0` | `id * 2 + 1 + order / (order + 1)`（奇数区间内的小数） |

`renderEffect` 入队时：

- `id` = 组件 `instance.uid`
- `isPre` = `false`
- `order` = 创建时的 `instance.effectCount++`

### 3.2 父子组件顺序

组件在创建时递增分配 `uid`（父先于子创建，故父 `uid` 更小）：

```js
// VaporComponentInstance
this.uid = uid++
```

父组件 job 的主序大致落在 `uid * 2 + 1` 一带，子组件更大。二分插入后，flush 时 **父相关更新先于子**。

示例（示意）：

```
Parent uid=0  → order ≈ 1
Child  uid=1  → order ≈ 3
```

同一 tick 内父子都被脏掉时，队列按 order 升序执行，避免子组件先读到“父尚未更新完”的中间态。

### 3.3 同组件内多个 renderEffect

同一组件内，每个 `renderEffect` 创建时拿走一个递增的 `effectCount`：

```js
this.order = instance ? instance.effectCount++ : 0
```

编码后：

- 第 0 个 effect：`uid * 2 + 1`
- 第 1 个：`uid * 2 + 1 + 1/2 = uid * 2 + 1.5`
- 第 2 个：`uid * 2 + 1 + 2/3 ≈ uid * 2 + 1.666…`

分数项 `order / (order + 1)` 落在 `(0, 1)`，因此：

1. **不会越过下一个组件的偶数边界**（下一个组件的 pre 位是 `(uid+1)*2`）
2. **同组件内按创建顺序稳定排序**（模板里先出现的 binding 先更新）

示例：

```js
// 编译结果示意（同一组件内）
renderEffect(() => setText(el1, ctx.title))   // effectCount = 0
renderEffect(() => setText(el2, ctx.count))   // effectCount = 1
renderEffect(() => setClass(el3, ctx.cls))    // effectCount = 2
```

`title` / `count` / `cls` 同时变更时，执行顺序仍是 0 → 1 → 2。

### 3.4 插入策略

队列保持按 `order` 有序。新 job 若比队尾更大则直接 append；否则在 `[flushIndex, length)` 区间二分查找插入点。正在 flush 时，已执行过的前缀不再重排，新 job 插在尚未执行的部分中正确位置。

### 3.5 pre / 偶数 order 的额外含义

`flushPreFlushCbs` 会跳过 `order & 1`（奇数）以及 `Infinity`，只冲刷偶数 order（`isPre: true` 的 job）。这与 Vue 经典 scheduler 中 “pre watch 在组件更新前执行” 的模型一致。当前 vapor 的 `renderEffect` 走非 pre 路径；`watch` 默认 `queueJob(job)` 也未传 `isPre`，但 API 与位编码为 pre flush 留了扩展点。

---

## 4. 生命周期时序与 post 队列（重点）

### 4.1 为什么必须有 post 队列

主队列负责“把 DOM 更新做完”；很多逻辑必须在 **本轮 DOM 更新之后** 再跑，例如：

- `onMounted`：节点已 insert
- `onUpdated`：本次渲染引起的 DOM 变更已落地
- templateRef 赋值、Teleport 真正挂到目标、Transition enter、cssVars 应用等

若把这些和 `renderEffect` 混在同一同步直调路径里，用户在 `onUpdated` 里读到的 DOM 可能仍是旧的，或 ref 尚未挂上。

### 4.2 组件挂载

```js
insert(instance.block, parent, anchor)
if (instance.m) queuePostFlushCb(instance.m)   // onMounted
instance.isMounted = true
```

`onMounted` 不立刻执行，而是进 post 队列；app mount 结束时会 `flushOnAppMount()`（先 pre flush，再 post flush），保证挂载钩子看到的是已插入的 DOM。

### 4.3 beforeUpdate / updated 与 renderEffect

当组件已挂载且注册了更新钩子时：

```js
// RenderEffect.fn（简化）
if (hasUpdateHooks && instance.isMounted && !instance.isUpdating) {
  instance.isUpdating = true
  if (instance.bu) invokeArrayFns(instance.bu)  // beforeUpdate：同步，在写 DOM 前
  this.render()
  queuePostFlushCb(updateJob)                   // updated：进 post
} else {
  this.render()
}

// updateJob
() => {
  instance.isUpdating = false
  if (instance.u) invokeArrayFns(instance.u)
}
```

时序保证：

```
queueJob(renderEffect job)
        ↓ flush 主队列
beforeUpdate  →  render（写 DOM）  →  queuePostFlushCb(updated)
        ↓ flush 后置队列
updated
```

同一组件多个 `renderEffect` 触发时，`isUpdating` 避免重复进入 “beforeUpdate 包装”；`updated` 通过 post 队列在 **本轮所有主队列 job 结束后** 再触发。

### 4.4 卸载与作废

卸载时：

```js
invalidateMount(instance.m)
invalidateMount(instance.a)
// ...
if (instance.um) queuePostFlushCb(instance.um)
```

`invalidateMount` 给尚未执行的 `mounted` / `activated` 打上 `DISPOSED`，防止“刚 queue 了 mounted，随即又卸载”时钩子仍被执行。`unmounted` 则正常进 post，在 DOM 移除相关逻辑协调后执行。

### 4.5 post 队列内部嵌套

若正在执行 `activePostJobs` 时又 `queuePostFlushCb`：

- 普通 id：追加到当前 `postJobs`，本轮结束后由外层 `flushJobs` 的递归再冲
- `id === -1`（如部分 templateRef / Transition 回调）：插入到 **当前正在执行的 post 队列** 的当前位置之后，保证“紧跟当前逻辑、仍属 post 阶段”

### 4.6 完整一轮时序（示意）

```js
count.value++           // 同步：只入队
await nextTick()        // 或自然 microtask

// flushJobs:
//   1) Parent renderEffects（含 beforeUpdate）
//   2) Child  renderEffects
// flushPostFlushCbs:
//   3) updated / mounted / ref / Teleport / Transition ...
```

---

## 5. 递归更新控制（重点）

递归更新有两层含义：**允许受控地再次入队**，以及 **防止无限自触发**。

### 5.1 `ALLOW_RECURSE`：执行期间允许再次入队

`RenderEffect` 同时打开：

- `EffectFlags.ALLOW_RECURSE`（响应式 effect 层）
- `SchedulerJobFlags.ALLOW_RECURSE`（scheduler job 层）

flush 某个 job 时：

```js
if (job.flags & SchedulerJobFlags.ALLOW_RECURSE) {
  job.flags &= ~SchedulerJobFlags.QUEUED   // 执行前清 QUEUED
}
try {
  job()
} finally {
  if (!(job.flags & SchedulerJobFlags.ALLOW_RECURSE)) {
    job.flags &= ~SchedulerJobFlags.QUEUED
  }
}
```

含义：

- **有 `ALLOW_RECURSE`**：执行前就清掉 `QUEUED`。若 job 执行过程中（或同步链路里）又触发了同一 job 的 `notify` → `queueJob`，可以再次入队，进入本轮后续或下一轮 flush。
- **无 `ALLOW_RECURSE`**：执行期间仍保持 `QUEUED`，重复 `queueJob` 会被去重丢掉；执行结束后再清标志。

这对 renderEffect 很关键：更新过程中可能再次改依赖（或子树又通知上来），需要允许“再排一次”，而不是静默丢失。

示例：

```js
// 组件更新时，renderEffect 里又改了另一个会脏掉自身的状态
renderEffect(() => {
  setText(el, count.value)
  if (count.value === 1) {
    count.value = 2  // 若允许 recurse，会再入队一次 job
  }
})
```

没有 `ALLOW_RECURSE` 时，第二次 `queueJob` 可能因仍带着 `QUEUED` 而被忽略，UI 停在中间态。

### 5.2 递归上限：`RECURSION_LIMIT = 100`

开发模式下，`checkRecursiveUpdates(seen, fn)` 用 `Map` 统计 **同一个 job 函数** 在本轮 flush 中的执行次数。超过 100 次则报错并跳过：

> Maximum recursive updates exceeded in component \<Xxx\>.  
> This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself.

典型坏模式：

```js
watch(source, () => {
  source.value++   // 自己改自己，每轮 flush 又入队
})

// 或在 updated 里无条件改依赖，再次触发 renderEffect
onUpdated(() => {
  count.value++
})
```

这与 `ALLOW_RECURSE` 互补：

- `ALLOW_RECURSE`：**允许**有限次数的再调度（正确性）
- `RECURSION_LIMIT`：**禁止**失控的无限自激（安全性）

### 5.3 flush 末尾的链式再入

```js
flushPostFlushCbs(seen)
currentFlushPromise = null
if (jobsLength || postJobs.length) {
  flushJobs(seen)   // 本轮又产生了新任务，同步继续冲
}
```

post 钩子里若再次改状态并 `queueJob`，会在同一调用栈内继续 flush，直到队列清空（或触发递归上限）。这保证 `nextTick` 回调看到的是“尽量稳定”的 DOM，而不是“还挂着未跑完的更新”。

---

## 6. 内部标志位（`SchedulerJobFlags`）

```js
export const SchedulerJobFlags = {
  QUEUED: 1 << 0,         // 0b001
  ALLOW_RECURSE: 1 << 1,  // 0b010
  DISPOSED: 1 << 2,       // 0b100
}
```

标志挂在 **job 函数自身** 上（`job.flags`），用位运算组合。

### 6.1 `QUEUED`（已入队）

- **置位**：`queueJobWorker` 成功入队时
- **清位**：job 执行结束时（或 `ALLOW_RECURSE` 时在执行前）
- **作用**：同一 flush 周期内去重

```js
queueJob(job)  // flags |= QUEUED，进入 jobs
queueJob(job)  // 已有 QUEUED → 直接 return，不重复插入
```

### 6.2 `ALLOW_RECURSE`（允许递归再入队）

- **置位**：`RenderEffect` 构造时 `this.job.flags |= ALLOW_RECURSE`
- **作用**：执行期间清除 `QUEUED`，使该 job 可再次被调度
- **对比**：普通 post 回调默认不允许在“带着 QUEUED 的执行途中”再次入队（除非另行处理）

### 6.3 `DISPOSED`（已作废）

- **置位**：`invalidateMount`、Teleport 取消挂载任务、ref cleanup 等
- **作用**：flush 时若发现 `DISPOSED`，跳过执行（主队列）或不再调用（post 队列）

```js
// 组件快速挂上又卸下
mountComponent(child)           // queuePostFlushCb(child.m)
unmountComponent(child)         // invalidateMount(child.m) → DISPOSED
// 随后 flush post：mounted 被跳过，避免在已卸载实例上跑逻辑
```

说明：`hook.flags` 可能一开始是 `undefined`；位运算会把它当成 `0`，因此 `flags |= DISPOSED` 仍然安全。

### 6.4 与 `EffectFlags` 的关系

| 层级 | 标志 | 含义 |
|------|------|------|
| `@vue/reactivity` | `EffectFlags.ALLOW_RECURSE` / `PAUSED` 等 | effect 是否可重入、是否暂停 notify |
| scheduler | `SchedulerJobFlags.*` | job 在队列中的去重、再入队、作废 |

`notify()` 会先看 effect 是否 `PAUSED`；通过后才 `queueJob`。两套标志分工不同，不要混淆。

---

## 7. nextTick 的原理与触发时机

### 7.1 实现

```js
export function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(fn) : p
}
```

- 若当前已有待执行的 flush（`currentFlushPromise` 非空）：回调挂在 **这次 flush 的 Promise** 后面。
- 若当前没有调度中的 flush：挂在一个已 resolved 的 Promise 上，等价于“下一个 microtask”。

### 7.2 触发时机（相对 scheduler）

```
同步代码：ref 变更 → queueJob → 创建 currentFlushPromise
同步代码：nextTick(fn) → fn 排在 currentFlushPromise 之后
        ↓
microtask 1: doFlushJobs / flushJobs
             → 主队列 jobs
             → post 队列（updated / mounted / ...）
             → 若仍有新任务，同步递归 flushJobs
             → currentFlushPromise = null
        ↓
microtask 2: nextTick 的 fn
```

因此：

```js
count.value++
await nextTick()
// 此处 DOM 与 post 钩子（updated 等）通常已完成
expect(el.textContent).toBe('1')
```

### 7.3 几种常见调用时机

| 时机 | 行为 |
|------|------|
| 在会触发更新的同步代码之后立刻 `nextTick` | 等本轮 scheduler flush 结束再执行 |
| 没有待 flush 任务时 `nextTick` | 下一个 microtask 立刻轮到（几乎“马上”，但仍异步） |
| flush 过程中又 `queueJob`，且链到同一 `currentFlushPromise` | `nextTick` 仍等整链 flush 结束（因为 then 挂在同一 promise 上；递归 flush 在该 promise 的 executor 完成前同步跑完） |
| `flush: 'sync'` 的 watch | 不经 scheduler，立即跑；与 `nextTick` 无直接排队关系 |

### 7.4 和 post 队列的关系

`nextTick` **不是** post 队列的别名。post 队列是 scheduler 内部阶段；`nextTick` 是挂在 flush Promise 上的用户态回调。正常顺序是：

1. jobs
2. postJobs（生命周期、ref、过渡等）
3. `nextTick` 回调

所以在 `nextTick` 里可以安全读取由本次更新写入的 DOM，以及多数 post 阶段副作用的结果。

### 7.5 最小示例

```js
import { ref } from '@vue/reactivity'
import { nextTick, renderEffect, /* mount app... */ } from 'pure-vapor'

const count = ref(0)
// 假设模板里有：renderEffect(() => setText(el, count.value))

count.value = 1
console.log(el.textContent) // 可能仍是旧值（尚未 flush）

await nextTick()
console.log(el.textContent) // '1'（jobs + post 已完成）
```

测试里常用的 `flushAll()`（`await Promise.resolve()`）与“等一轮 microtask / flush”是同一思路；有明确更新时更推荐 `await nextTick()`，语义与生产代码一致。

---

## 8. 总览图

```
                    ┌─────────────────────┐
  响应式 trigger ──►│ RenderEffect.notify │
                    └──────────┬──────────┘
                               │ queueJob(job, uid, false, effectOrder)
                               ▼
                    ┌─────────────────────┐
                    │ jobs[] 按 order 排序 │  ← QUEUED 去重
                    └──────────┬──────────┘
                               │ Promise.then (microtask)
                               ▼
                    ┌─────────────────────┐
                    │ flushJobs           │
                    │  · beforeUpdate     │
                    │  · render / DOM     │
                    │  · queuePost(updated)│
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ flushPostFlushCbs   │  ← DISPOSED 跳过
                    │  mounted/updated/…  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ nextTick callbacks  │
                    └─────────────────────┘
```

---

## 9. 相关源码索引

| 文件 | 内容 |
|------|------|
| `packages/pure-vapor/src/internal/scheduler.js` | 队列、标志、flush、`nextTick`、递归检测 |
| `packages/pure-vapor/src/vapor/renderEffect.js` | `notify` → `queueJob`；`updated` → `queuePostFlushCb` |
| `packages/pure-vapor/src/vapor/component.js` | `uid` / `effectCount`；mount/unmount 与 post 钩子 |
| `packages/pure-vapor/src/internal/watch.js` | `flush: 'sync' \| 'pre' \| 'post'` 与两套队列 |
| `packages/pure-vapor/__tests__/renderEffect.spec.js` | `updateJob` 与 `onUpdated` 时序 |
| `packages/pure-vapor/__tests__/internal.spec.js` | `queueJob` + `nextTick` / flush 基础行为 |
