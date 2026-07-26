# pure-vapor upstream 同步清单

以 `@vue/runtime-vapor` 为黄金标准，`compiler-vapor` 生成契约为约束。同步时删除 hydration / SSR / vdomInterop / Suspense 路径，保留 CSR else 分支。

## 最后同步

- 基准：`origin/minor` @ `3c9499c35`（`v3.6.0-rc.2`），合并提交 `3987ef6ea`
- 本轮 CSR 移植：#15127 / #15065 / #15124（编译契约）+ #15069 / #15125 / #15149 / #15130 / #15141 / #15095
- 明确跳过：hydration / SSR / vdomInterop / Suspense 相关提交

## 模块对照表

| runtime-vapor | pure-vapor | 最后同步说明 |
|---------------|------------|--------------|
| `src/index.ts` | `src/index.js` | 导出契约；含 `setStaticTemplateRef` / `setTemplateRefBinding` |
| `src/apiTemplateRef.ts` | `src/vapor/apiTemplateRef.js` | 同步至 3.6.0-rc.2；#15095 revert function ref pauseTracking |
| `src/slotBoundary.ts` | `src/vapor/slotBoundary.js` | P0 slot 基础设施 |
| `src/slotFragment.ts` | `src/vapor/slotFragment.js` | P0 slot 状态机 |
| `src/componentSlots.ts` | `src/vapor/componentSlots.js` | P0 slot / forwarded / NON_STABLE |
| `src/block.ts` | `src/vapor/block.js` | `isValidSlot` / `trackSlotBoundaryDirtying` |
| `src/apiCreateIf.ts` | `src/vapor/apiCreateIf.js` | P1 SLOT_ROOT |
| `src/apiCreateFor.ts` | `src/vapor/apiCreateFor.js` | P1 flags / createForSlots |
| `src/apiCreateDynamicComponent.ts` | `src/vapor/apiCreateDynamicComponent.js` | P1 SLOT_ROOT / KeepAlive identity |
| `src/fragment.ts` | `src/vapor/fragment.js` | 同步至 3.6.0-rc.2；#15125 `isForFragment` / `isForBlock` |
| `src/component.ts` | `src/vapor/component.js` | 同步至 3.6.0-rc.2；#15149 / #15130 / #15141 |
| `src/renderEffect.ts` | `src/vapor/renderEffect.js` | 同步至 3.6.0-rc.2；#15141 `restoreCurrentInstance` |
| `src/components/Transition.ts` | `src/vapor/components/Transition.js` | 同步至 3.6.0-rc.2；#15069 structural v-if+v-show / #15125 精简 |
| `src/components/TransitionGroup.ts` | `src/vapor/components/TransitionGroup.js` | 同步至 3.6.0-rc.2；#15125 ReactiveEffect / lazy hooks |
| `src/components/KeepAlive.ts` | `src/vapor/components/KeepAlive.js` | ctx / scope / include-exclude prune |
| `src/components/Teleport.ts` | `src/vapor/components/Teleport.js` | 同步至 3.6.0-rc.2；#15141 |
| `src/dom/prop.ts` | `src/vapor/dom/prop.js` | 同步至 3.6.0-rc.2；#15149 functional fallthrough skip |
| `src/dom/event.ts` | `src/vapor/dom/event.js` | API 不变；#15127 编译器默认 `on()`，`.delegate` opt-in |
| `src/scopeId.ts` | `src/vapor/scopeId.js` | 动态根 / fragment scopeId |
| `src/componentProps.ts` | `src/vapor/componentProps.js` | 同步至 3.6.0-rc.2；#15141 parent-context computed |
| `src/apiDefineComponent.ts` | `src/vapor/apiDefineComponent.js` | defineVaporComponent 运行时 |
| `src/apiDefineCustomElement.ts` | `src/vapor/apiDefineCustomElement.js` | CSR CE（无 SSR CE） |
| `src/insertionState.ts` | `src/vapor/insertionState.js` | 同步至 3.6.0-rc.2；#15065 prepend logicalIndex 默认 0 |
| `runtime-core` `restoreCurrentInstance` | `src/internal/instance.js` | #15141 |
| `runtime-core` `isFunctionalFallthroughKey` | `src/internal/functionalFallthrough.js` | #15149 |
| `runtime-dom` VAPOR 段 | `src/internal/baseTransition.js` 等 | Transition DOM 辅助 |

## 明确不同步

- `vdomInterop.ts`、`dom/hydration.ts`、`hydrateFragment.ts`
- 真 SSR/hydration（`createVaporSSRApp` 仅作 CSR stub）、Suspense、VDOM 互操作 slot 路径
- `runtime-dom` / `runtime-core` 整包依赖

## pure-vapor 自有扩展（非 upstream）

| 模块 | 说明 |
|------|------|
| `src/vapor/h.js` | Vapor 原生 `h` / `Fragment`：返回 Block，委托 `createPlainElement` / `createComponent` / `createDynamicComponent`；**不是** runtime-core 的 VDOM `h` |

## 测试移植对照

| runtime-vapor | pure-vapor | 说明 |
|---------------|------------|------|
| `__tests__/dom/prop.spec.ts` | `__tests__/dom/prop.spec.js` | 跳过 hydration |
| `__tests__/scopeId.spec.ts` | `__tests__/scopeId.spec.js` | 跳过 interop |
| `__tests__/componentProps.spec.ts` / `componentAttrs.spec.ts` | `__tests__/componentProps.spec.js` | CSR 子集（含 #15149） |
| `__tests__/errorHandling.spec.ts` | `__tests__/errorHandling.spec.js` | #15130 prod setup containment |
| `__tests__/components/Transition.spec.ts` | `__tests__/components/Transition.spec.js` | 无 interop/hydration；含 #15069 |
| `__tests__/components/TransitionGroup.spec.ts` | `__tests__/components/TransitionGroup.spec.js` | CSR；含 #15125 |
| `__tests__/components/KeepAlive.spec.ts` | `__tests__/components/KeepAlive.spec.js` | CSR 子集 |
| `__tests__/components/Teleport.spec.ts` | `__tests__/components/Teleport.spec.js` | CSR 子集 |
| compiler-vapor 事件 / logicalIndex | `__tests__/compileSmoke.spec.js` | #15127 / #15065 / #15124 快照 |

## 后续 minor 合并流程

1. 合并官方 `minor` 到本 monorepo。
2. `git log packages/runtime-vapor --since=<上次同步>` 按模块过滤 commit。
3. 对照上表逐文件 diff → 移植 CSR 逻辑 → 删 hydration/interop 分支。
4. 移植或扩展对应 `__tests__`（跳过 interop/hydration describe）。
5. 运行 `vp run build pure-vapor && vp run test pure-vapor`。
6. 更新本表「最后同步说明」列与 `compileSmoke` 快照（若 compiler 生成 import 有变）。
