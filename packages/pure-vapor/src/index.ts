export * from '@vue/shared'
export * from '@vue/reactivity'
export const version: string = __VERSION__

export { createVaporApp } from './apiCreateApp'
export type { VaporComponent, Block } from './types'
export { renderEffect } from './renderEffect'
export { insert, prepend, remove, setInsertionState } from './block'
export {
  createElement,
  createTextNode,
  createComment,
  txt,
  next,
  child,
  nthChild,
} from './dom/node'
export { template } from './dom/template'
export {
  setText,
  setElementText,
  setBlockText,
  setHtml,
  setBlockHtml,
  setClass,
  setStyle,
  setAttr,
  setValue,
  setProp,
  setDOMProp,
  setDynamicProps,
} from './dom/prop'
export {
  on,
  delegate,
  delegateEvents,
  setDynamicEvents,
  createInvoker,
  toHandlers,
  withKeys,
  withModifiers,
} from './dom/event'
export {
  createComponent,
  resolveComponent,
  resolveDynamicComponent,
  createComponentWithFallback,
  createPlainElement,
  createDynamicComponent,
} from './component'
export {
  resolveDirective,
  withVaporDirectives,
  applyVShow,
  applyTextModel,
  applyRadioModel,
  applyCheckboxModel,
  applySelectModel,
  applyDynamicModel,
} from './directives'
export { createSlot, withVaporCtx } from './slot'
export {
  createIf,
  createKeyedFragment,
  createFor,
  createForSlots,
  getRestElement,
  getDefaultValue,
  createTemplateRefSetter,
  setBlockKey,
} from './controlFlow'
export {
  VaporTeleport,
  VaporKeepAlive,
  VaporTransition,
  VaporTransitionGroup,
} from './builtins'

import './hmr'
