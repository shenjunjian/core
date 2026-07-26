_This package is **experimental**._

# Pure-Vapor

`Pure Vapor` 就是Vue 3.6 的移除掉Vnode逻辑与SSR逻辑后的版本。它仅重写了 runtime-vapor , 所以能复用完整的Vue生态工具，与正常Vue-vapor使用保持一致。

## 快速上手

在使用 create-vue 或 create-vite 脚本架搭建一个标准的Vue工程，然后仅更改一行依赖即完成适配工作, 后续开发与官方Vapor开发一致。

```json
"dependencies": {
    "vue": "npm:pure-vapor@latest"
  }
```

阅读[Vue Vapor Release说明](https://github.com/vuejs/core/blob/minor/CHANGELOG.md)来熟悉Vapor的开发规范。下面是主要的细节：

在`main.js`中创建APP时，可以使用createApp/createVaporApp都可以,每一个SFC组件中，通过 `<script setup vapor>  <script vapor> <template vapor>` 都能启用Vapor编译。

```js
import { createVaporApp } from "vue";
import App from "./App.vue";

createVaporApp(App).mount("#app");
```

## 项目起因

Vue的Vapor模式从提出到目前，持续了2年多的时间，这实在是有点拖沓了。 我非Vue官方成员，这其中原因只能猜测一下了： 1. 尤大避免Vue生态的碎片化，需要完全兼容VNode 模式。2. 可能是开发人员变动与投入不足引起的，毕竟这2年是 AI 为王，技术退后的时代。

Vue 官方需要支持`VNode模式 + 混合模式 + Vapor模式`的一种理想产物，这其中必要造成逻辑的复杂与 TS 声明的复杂。 我站在一个Vue爱好者的/学习者的角度，我不希望有这种复杂性的，复杂会阻碍我们窥探Vapor运行原理，所以我才重写当前项目。

我选择使用纯 JavaScript 仅重写 Vapor 运行时，其它的包，比如： `@vue/shared` 、 `@vue/reactivity` 、 `compiler-*` 等包都是官方版本。

## 与 @vue/runtime-vapor 的差异

| -    | 差异项                                | 说明                                                                    |
| ---- | ------------------------------------- | ----------------------------------------------------------------------- |
| 简化 | 纯 JavaScript 开发                    | 便于学习，加快阅读速度，在发包前，补充官方的Ts 声明文件，不影响用户使用 |
| 简化 | 移除了Vnode , vaporInteropPlugin 支持 | 简化逻辑与体积，便于学习                                                |
| 简化 | 移除了 SSR/Hydration 代码             | 无真 SSR/注水；导出 `createSSRApp` / `createVaporSSRApp` 与 `vue/server-renderer` **stub**（`renderToString` → `''`），便于 VitePress/Nuxt 等环境不报错，客户端按 CSR 挂载 |
| 简化 | 移除了 Suspense                       | 实验特性，对 runtime 影响较多，**待官方稳定后，再补充**                 |
| 增强 | 支持h 函数                            | 返回值是 **Block**（DOM / 组件实例 / Fragment），**不是** VNode         |
| 增强 | getCurrentInstance()                  | 返回 Vapor Instance                                                     |
| 增强 | 多 App 隔离                           | **计划中**                                                              |

由于 Pure Vapor下已经没有传统模式了，为了方便，特将少量传统模式的函数指向Vapor版本的函数，以便于使用，也不会带来歧义。 但是建议大家仍然使用Vapor的函数名，这样可以方便迁回使用官方的包。

| 别名                   | 指向                        |
| ---------------------- | --------------------------- |
| `createApp`            | `createVaporApp`            |
| `createSSRApp`         | `createVaporSSRApp`（= `createVaporApp`） |
| `defineComponent`      | `defineVaporComponent`      |
| `defineAsyncComponent` | `defineVaporAsyncComponent` |
| `useCssVars`           | `useVaporCssVars`           |

## 程序化渲染：`h` / `Fragment`

本包导出 **Vapor 原生** `h` 与 `Fragment`（见 `src/vapor/h.js`）：

- 返回值是 **Block**（DOM / 组件实例 / Fragment），**不是** VNode
- 内部委托 `createPlainElement` / `createComponent` / `createDynamicComponent`
- 响应式与编译器产物一致：props / children 使用 **getter 或 ref** 才会随数据更新

```js
import { h, Fragment, ref, defineVaporComponent } from "pure-vapor";

const msg = ref("hi");
const Comp = defineVaporComponent({
  setup() {
    return h("div", { class: () => msg.value }, () => msg.value);
  },
});
```

| 用法                         | 说明                                  |
| ---------------------------- | ------------------------------------- |
| `h('div', props, children)`  | 原生标签 → Block（Element）           |
| `h(VaporComp, props, slots)` | Vapor 组件（需 `__vapor`）            |
| `h(Fragment, null, [a, b])`  | 多根 Block                            |
| `h(tagRef, …)`               | 动态 type（`createDynamicComponent`） |

## 多 App 隔离

目前Vue中，有众多的变量是包级别的变量，即通过闭包来共享同一个变量，如果同一个页面上有多个Vue App实例，那么更新时可能会受污染。计划将这些闭包变量挂载到app 实例上，以避免冲突。

计划待Vue 3.6 正式发布后添加。

## vue-router 限制

官方 **vue-router 不能直接在 pure-vapor 上使用**， `<router-view> 与 <router-link>` 无法正常工作，需要等官方发布Vue-router 6.0吧！

> 本来是可以写一个 pure-vue-router 的包， 但预计官方在Vue 3.6正式版本出来之前会解决这个问题，所以先等待吧。

## 测试

```bash
pnpm i
vp run build pure-vapor
vp run test pure-vapor
```

`packages/pure-vapor/__tests__/` 覆盖：

- **编译器冒烟**：`compileSmoke.spec.js`（`runtimeModuleName: 'pure-vapor'` 快照 + `new Function` 挂载）
- **导出契约**：`exports.spec.js`（必需符号存在、排除表符号不存在）
- **控制流 / 组件核心**：`block` / `if` / `for` / `componentSlots` / `templateRef` / `renderEffect`
- **程序化渲染**：`h.spec.js`（标签 / 组件 / 响应式 props&children / Fragment）
- **内置组件**：`components/Transition` / `TransitionGroup` / `KeepAlive` / `Teleport`
- **DOM 层**：`dom/prop` / `scopeId` / `componentProps`
- **App / internal**：`apiCreateVaporApp` / `internal` / `multi-app` / `hmr`

需要等待 scheduler 队列时，使用 `__tests__/_utils.js` 的 `flushAll()`（`await Promise.resolve()`）。

## upstream 同步

与 `@vue/runtime-vapor` 的模块对照、测试移植范围及后续 minor 合并流程见 [UPSTREAM-SYNC.md](./UPSTREAM-SYNC.md)。

## 开发

与测试命令相同；完整 monorepo 校验见根目录 `AGENTS.md`。
