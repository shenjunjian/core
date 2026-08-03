---
name: pure-vapor兼容落地
overview: 在不修改 compiler-* / runtime-* 包且仅依赖 shared/reactivity 的前提下，完善 `packages/pure-vapor` 作为 `vue` alias 目标，保证当前 compiler-vapor 产物可直接运行。优先交付用户侧 alias 接入方案与可验证的 API 导出边界。
todos:
  - id: freeze-compiler-contract
    content: 提取并冻结 compiler-vapor 对 vue 导入符号白名单
    status: pending
  - id: trim-package-exports-deps
    content: 清理 pure-vapor package.json 的 SSR/compiler 导出与依赖
    status: pending
  - id: fill-compat-helpers
    content: 在 pure-vapor 内补齐无 runtime-* 依赖的兼容导出实现
    status: pending
  - id: add-contract-tests
    content: 新增 alias 导入契约与包边界回归测试
    status: pending
  - id: write-consumer-alias-docs
    content: 编写用户侧 alias 配置文档并声明支持边界
    status: pending
isProject: false
---

# pure-vapor 无缝 alias 计划

## 目标与约束

- 目标：让 vapor 模板编译产物中的 `from "vue"` 在用户侧通过 alias 指向 `pure-vapor` 后可直接运行。
- 硬约束：不修改任何 `compiler-*` / `runtime-*` 包；`pure-vapor` 只依赖 `@vue/shared`、`@vue/reactivity`；不包含 SSR；不兼容 VNode 组件路径。

## 现状结论（用于设计）

- `pure-vapor` 已有基础运行时代码，但 `package.json` 当前仍暴露并依赖 `compiler-sfc`、`server-renderer`。按目标应移除这些内容，收敛为纯运行时包（见 [`e:/core/packages/pure-vapor/package.json`](e:/core/packages/pure-vapor/package.json)）。
- `compiler-vapor` 生成代码包含 `import { ... } from "vue"` 属于预期行为；在用户侧通过 alias 将 `vue` 指向 `pure-vapor` 即可。
- 兼容关键点不是“是否从 `vue` 导入”，而是 `pure-vapor` 是否完整覆盖 vapor 编译产物实际导入到的符号集合。

## 实施方案

1. 精确冻结 compiler-vapor 需要的 `vue` 导出白名单
   - 从编译器生成器与快照中提取符号并去重，形成 `pure-vapor` 的“编译期契约导出清单”。
   - 关键参考：[`e:/core/packages/compiler-vapor/src/generate.ts`](e:/core/packages/compiler-vapor/src/generate.ts)、[`e:/core/packages/compiler-vapor/src/generators`](e:/core/packages/compiler-vapor/src/generators)、[`e:/core/packages/compiler-vapor/__tests__/__snapshots__/compile.spec.ts.snap`](e:/core/packages/compiler-vapor/__tests__/__snapshots__/compile.spec.ts.snap)。

2. 清理 `pure-vapor` 包元数据到“纯运行时”
   - 移除 `exports` 中 `./server-renderer`、`./compiler-sfc` 子路径。
   - 移除 `dependencies` 中 `@vue/compiler-sfc`、`@vue/server-renderer`，只保留 `@vue/shared` 与 `@vue/reactivity`。
   - 同步核对 `main/module/types/files` 与实际产物命名一致。

3. 以最小实现补齐 alias 所需导出覆盖（仅在 `pure-vapor` 内）
   - 在 [`e:/core/packages/pure-vapor/src/index.ts`](e:/core/packages/pure-vapor/src/index.ts) 维护清晰的导出分层：
     - Vapor 核心导出（已有）。
     - shared/reactivity 透出（已有，保留）。
     - 为 compiler-vapor 产物提供的额外 helper 导出（最小可运行实现，不引入 runtime-\* 依赖）。
   - 对“被 vapor 编译产物引用、但不属于 runtime-vapor 主导出面”的 helper，采用纯 vapor 场景可接受的实现策略（如运行时解析组件/指令注册表、字符串化、事件修饰器）。

4. 增加契约级测试（防回归）
   - 在 `packages/pure-vapor/test` 新增“编译产物导入兼容”测试：模拟/复用 compiler-vapor 输出形态，验证从 `pure-vapor` 导入后可执行。
   - 新增“禁止误引 SSR/compiler 依赖”断言测试（读取包导出与依赖字段）。

5. 交付用户侧 alias 接入文档（你当前优先项）
   - 在 `pure-vapor` 文档中给出 Vite / Rollup / Webpack / TS `paths` 示例：将 `vue` 指向 `pure-vapor`。
   - 明确边界：仅支持 vapor 编译产物；不支持 SSR 与 VNode 渲染函数。

## 最小符号白名单模板（草案）

- 说明：以下为“alias `vue` -> `pure-vapor`”的首版模板，最终以 `compiler-vapor` 快照实际导入集合为准。
- Vapor 核心（来自运行时实现）：
  - `template`、`txt`、`child`、`next`、`nthChild`
  - `setText`、`setBlockText`、`setHtml`、`setBlockHtml`、`setClass`、`setStyle`、`setAttr`、`setValue`、`setProp`、`setDOMProp`、`setDynamicProps`
  - `insert`、`prepend`、`setInsertionState`
  - `renderEffect`
  - `on`、`delegate`、`delegateEvents`、`setDynamicEvents`、`createInvoker`
  - `createIf`、`createFor`、`createForSlots`、`createKeyedFragment`
  - `createComponent`、`createComponentWithFallback`、`createPlainElement`、`createDynamicComponent`
  - `createSlot`、`withVaporCtx`、`createTemplateRefSetter`、`setBlockKey`
  - `applyVShow`、`applyTextModel`、`applyRadioModel`、`applyCheckboxModel`、`applySelectModel`、`applyDynamicModel`、`withVaporDirectives`
  - `getRestElement`、`getDefaultValue`
  - `VaporTeleport`、`VaporKeepAlive`、`VaporTransition`、`VaporTransitionGroup`
- 额外兼容导出（编译产物常见导入）：
  - `resolveComponent`、`resolveDirective`、`resolveDynamicComponent`
  - `toDisplayString`、`toHandlers`、`toHandlerKey`、`camelize`
  - `withKeys`、`withModifiers`
  - `isRef`、`unref`
- 非目标导出（明确不支持）：
  - SSR 相关 API
  - VNode 渲染相关 API（`h`、`createVNode`、`render` 等）

## 验证清单

- `pure-vapor` 的 `package.json` 仅依赖 `@vue/shared`、`@vue/reactivity`。
- 使用 `compiler-vapor` 产物（`import {...} from "vue"`）+ alias 到 `pure-vapor` 可跑通最小应用。
- 无 `server-renderer` / `compiler-sfc` 暴露路径。
- 现有 `pure-vapor` 相关测试与新增契约测试通过。
