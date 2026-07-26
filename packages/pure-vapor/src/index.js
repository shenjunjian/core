/**
 * pure-vapor public entry.
 * Export surface aligned with vue/index-with-vapor (minus exclusion table).
 * See .cursor/plans/pure-vapor_纯运行时_8015eb3b.plan.md — 导出契约
 */

import './internal/hmr.js'

// ---------------------------------------------------------------------------
// A. @vue/reactivity — re-export (runtime-core parity)
// ---------------------------------------------------------------------------

export {
  reactive,
  ref,
  readonly,
  unref,
  proxyRefs,
  isRef,
  toRef,
  toValue,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  effect,
  stop,
  getCurrentWatcher,
  onWatcherCleanup,
  ReactiveEffect,
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
  computed,
} from '@vue/reactivity'

// ---------------------------------------------------------------------------
// @vue/shared — re-export (runtime-core / compiler subset)
// ---------------------------------------------------------------------------

export {
  camelize,
  capitalize,
  hyphenate,
  toHandlerKey,
  toDisplayString,
  normalizeProps,
  normalizeClass,
  normalizeStyle,
  extend,
} from '@vue/shared'

// ---------------------------------------------------------------------------
// B. runtime-core subset — internal/
// ---------------------------------------------------------------------------

export const version = __VERSION__

export { nextTick } from './internal/scheduler.js'

export {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from './internal/apiWatch.js'

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured,
  onServerPrefetch,
} from './internal/lifecycle.js'

export { provide, inject, hasInjectionContext } from './internal/apiInject.js'

export { ssrContextKey, useSSRContext } from './internal/ssrStubs.js'

export {
  useAttrs,
  useSlots,
  defineProps,
  defineEmits,
  defineExpose,
  defineOptions,
  defineSlots,
  defineModel,
  withDefaults,
  toHandlers,
} from './internal/apiSetupHelpers.js'

export { useModel } from './internal/useModel.js'
export { useTemplateRef } from './internal/useTemplateRef.js'
export { useId } from './internal/useId.js'
export { useCssModule } from './internal/useCssModule.js'

export { getCurrentInstance } from './internal/instance.js'

export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent,
  NULL_DYNAMIC_COMPONENT,
} from './internal/resolveAssets.js'

export { withModifiers, withKeys } from './internal/eventModifiers.js'

// ---------------------------------------------------------------------------
// C. @vue/runtime-vapor — vapor runtime (minus exclusion table)
// ---------------------------------------------------------------------------

export { createVaporApp, createVaporSSRApp } from './vapor/apiCreateApp.js'
export { vaporInteropPlugin } from './vapor/vaporInteropPlugin.js'
export { defineVaporComponent } from './vapor/apiDefineComponent.js'
export { defineVaporAsyncComponent } from './vapor/apiDefineAsyncComponent.js'
export {
  defineVaporCustomElement,
  VaporElement,
} from './vapor/apiDefineCustomElement.js'

export { VaporTeleport } from './vapor/components/Teleport.js'
export { VaporKeepAlive } from './vapor/components/KeepAlive.js'
export { VaporTransition } from './vapor/components/Transition.js'
export { VaporTransitionGroup } from './vapor/components/TransitionGroup.js'

export { insert, prepend, remove } from './vapor/block.js'
export { setInsertionState } from './vapor/insertionState.js'

export {
  createComponent,
  createComponentWithFallback,
  createAssetComponent,
  createPlainElement,
  isVaporComponent,
} from './vapor/component.js'

export { renderEffect } from './vapor/renderEffect.js'
export { createSlot, withVaporCtx } from './vapor/componentSlots.js'

export { template } from './vapor/dom/template.js'
export { createTextNode, child, nthChild, next, txt } from './vapor/dom/node.js'

export {
  setText,
  setBlockText,
  setHtml,
  setBlockHtml,
  setClass,
  setClassName,
  setStyle,
  setAttr,
  setValue,
  setProp,
  setDOMProp,
  setDynamicProps,
  setElementText,
} from './vapor/dom/prop.js'

export {
  on,
  onBinding,
  delegate,
  delegateEvents,
  setDynamicEvents,
  createInvoker,
  withVaporModifiers,
  withVaporKeys,
} from './vapor/dom/event.js'

export { createIf } from './vapor/apiCreateIf.js'
export { createKeyedFragment } from './vapor/apiCreateFragment.js'
export {
  createFor,
  createForSlots,
  createSelector,
  getRestElement,
  getDefaultValue,
} from './vapor/apiCreateFor.js'

export {
  createTemplateRefSetter,
  setStaticTemplateRef,
  setTemplateRefBinding,
} from './vapor/apiTemplateRef.js'
export { useVaporCssVars } from './vapor/helpers/useCssVars.js'
export { setBlockKey } from './vapor/helpers/setKey.js'
export { createDynamicComponent } from './vapor/apiCreateDynamicComponent.js'
export { h, Fragment } from './vapor/h.js'
export { withAsyncContext } from './vapor/apiSetupHelpers.js'

export { applyVShow } from './vapor/directives/vShow.js'
export {
  applyTextModel,
  applyRadioModel,
  applyCheckboxModel,
  applySelectModel,
  applyDynamicModel,
} from './vapor/directives/vModel.js'
export { withVaporDirectives } from './vapor/directives/custom.js'

export { isFragment, VaporFragment, DynamicFragment } from './vapor/fragment.js'

// ---------------------------------------------------------------------------
// Migration aliases (vue → pure-vapor)
// ---------------------------------------------------------------------------

export {
  createVaporApp as createApp,
  createVaporSSRApp as createSSRApp,
} from './vapor/apiCreateApp.js'
export { defineVaporComponent as defineComponent } from './vapor/apiDefineComponent.js'
export { defineVaporAsyncComponent as defineAsyncComponent } from './vapor/apiDefineAsyncComponent.js'
export { useVaporCssVars as useCssVars } from './vapor/helpers/useCssVars.js'
