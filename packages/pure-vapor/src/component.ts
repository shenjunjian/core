import { EffectScope, onScopeDispose, proxyRefs } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  invokeArrayFns,
  isBuiltInTag,
  isFunction,
  isPromise,
} from '@vue/shared'
import type {
  AppConfig,
  AppContext,
  Block,
  LifecycleHook,
  VaporComponent,
} from './types'
import { insert, isBlock, remove } from './block'
import { createComment } from './dom/node'
import { setDynamicProps } from './dom/prop'
import { getSlot } from './slot'
import { currentInstance, setCurrentInstance } from './renderEffect'
import { warn } from './warning'

// @internal
let uid = 0

/**
 * @internal
 */
export function expose(
  instance: VaporComponentInstance,
  exposed: Record<string, any>,
): void {
  instance.exposed = exposed || {}
}
export const emptyContext: AppContext = {
  app: null as any,
  config: {},
  provides: /*@__PURE__*/ Object.create(null),
}

export function createComponent(
  component: VaporComponent,
  rawProps?: any,
  rawSlots?: any,
  appContext?: emptyContext,
): VaporComponentInstance {
  const instance = new VaporComponentInstance(
    component,
    rawProps,
    rawSlots,
    appContext,
  )

  setupComponent(instance, component)

  return instance
}

export function resolveComponent(name: string): any {
  const instance = currentInstance
  if (!instance) {
    return name
  }
  const local = (instance.type as any).components
  if (local && local[name]) {
    return local[name]
  }
  const global = instance.appContext.components
  if (global && global[name]) {
    return global[name]
  }
  return name
}

export function resolveDynamicComponent(component: unknown): unknown {
  if (typeof component === 'string') {
    return resolveComponent(component)
  }
  return component
}

export function createPlainElement(
  tag: string,
  rawProps?: Record<string, unknown> | null,
  rawSlots?: Record<string, any> | null,
  isSingleRoot?: boolean,
  once?: boolean,
): Element {
  const el = document.createElement(tag)
  ;(el as any).$root = isSingleRoot
  if (rawProps) {
    // props 可能包含响应式 getter（通过 `$` 数组传入），每次 effect 合并后再打到 DOM。
    const apply = () => setDynamicProps(el, resolveDynamicProps(rawProps))
    if (once) {
      apply()
    } else {
      renderEffect(apply)
    }
  }
  if (rawSlots) {
    const slot = getSlot(rawSlots as any, 'default')
    if (slot) {
      insert(slot(), el)
    }
  }
  return el
}

export function createComponentWithFallback(
  component: unknown,
  props?: any,
  slots?: any,
  isSingleRoot?: boolean,
  once?: boolean,
  appContext?: AppContext,
): Block {
  const resolved = resolveDynamicComponent(component)
  // 运行时兜底策略：字符串视为原生元素，空值退化为注释节点，其他按组件处理。
  if (typeof resolved === 'string') {
    return createPlainElement(resolved, props, slots, isSingleRoot, once)
  }
  if (!resolved) {
    return createComment('vapor-component-fallback')
  }
  return createComponent(resolved as VaporComponent, props, slots, appContext)
}

export function createDynamicComponent(
  component: unknown | (() => unknown),
  props?: any,
  slots?: any,
  isSingleRoot?: boolean,
  once?: boolean,
): Block {
  const getter = typeof component === 'function' ? component : () => component
  let block: Block = createComment('vapor-dynamic-component')
  const render = () => {
    const value = getter()
    // 每次依赖变更都重新解析 component 类型，再走统一 fallback 分支。
    block = createComponentWithFallback(
      resolveDynamicComponent(value),
      props,
      slots,
      isSingleRoot,
      once,
    )
  }
  if (once) {
    render()
  } else {
    renderEffect(render)
  }
  return block
}

// 执行setup
export function setupComponent(
  instance: VaporComponentInstance,
  component: VaporComponent,
): void {
  const prevInstance = setCurrentInstance(instance)

  const setupFn = isFunction(component) ? component : component.setup
  const setupResult = setupFn
    ? setupFn(instance.props, {
        slots: instance.slots,
        attrs: instance.attrs,
        emit: instance.emit,
        expose: instance.expose,
      }) || EMPTY_OBJ
    : EMPTY_OBJ

  // const isAsyncSetup = isPromise(setupResult)

  // if (isAsyncSetup) {
  //   // For simplicity, we'll skip async setup handling for now
  //   instance.block = []
  // } else {
  handleSetupResult(setupResult, component, instance)
  // }

  setCurrentInstance(prevInstance)
  // 组件 effectScope stop 时自动触发卸载逻辑，保证副作用清理与 DOM 移除同步。
  onScopeDispose(() => unmountComponent(instance), true)
}

// 把setup的结果 保存到 setupState属性, 并调用 render 函数，保存到block属性
function handleSetupResult(
  setupResult: any,
  component: VaporComponent,
  instance: VaporComponentInstance,
) {
  // setup 直接返回 Block 时，视为“函数式渲染结果”；否则走 render + setupState。
  if (isBlock(setupResult)) {
    instance.block = setupResult
  } else if (component.render) {
    instance.setupState = proxyRefs(setupResult)
    instance.block =
      component.render(
        instance.setupState,
        instance.props,
        instance.emit,
        instance.attrs,
        instance.slots,
      ) || []
  } else {
    instance.block = []
  }
}

function resolveDynamicProps(rawProps: any): Record<string, unknown> {
  if (!rawProps) return {}
  if (!rawProps.$) return rawProps
  const merged: Record<string, unknown> = {}
  // `$` 中是动态 props 片段（函数），先按顺序合并，再覆盖静态字段。
  const list = rawProps.$ as Array<() => Record<string, unknown>>
  for (let i = 0; i < list.length; i++) {
    Object.assign(merged, list[i]())
  }
  for (const key in rawProps) {
    if (key !== '$') merged[key] = rawProps[key]
  }
  return merged
}

function queuePostFlushCb(job: any): void {
  Promise.resolve().then(() => {
    if (Array.isArray(job)) {
      invokeArrayFns(job)
    } else if (typeof job === 'function') {
      job()
    }
  })
}
export function mountComponent(
  instance: VaporComponentInstance,
  parent: ParentNode,
  anchor?: Node | null,
): void {
  // 生命周期调用顺序与 Vue 组件语义保持一致：bm -> 挂载 -> m(异步 flush)
  if (instance.bm) invokeArrayFns(instance.bm)
  insert(instance.block, parent, anchor)
  if (instance.m) queuePostFlushCb(instance.m)
  instance.isMounted = true
}

export function unmountComponent(
  instance: VaporComponentInstance,
  parentNode?: ParentNode,
): void {
  // 防止重复卸载：仅首次进入时触发生命周期与 scope 停止。
  if (instance.isMounted && !instance.isUnmounted) {
    if (instance.bum) invokeArrayFns(instance.bum)
    instance.scope.stop()
    if (instance.um) invokeArrayFns(instance.um)
    instance.isUnmounted = true
  }

  if (parentNode) {
    remove(instance.block, parentNode)
  }
}

export function getExposed(
  instance: VaporComponentInstance,
): Record<string, any> | undefined {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(instance.exposed, {
        get: (target, key) => target[key],
      }))
    )
  }
}

export function getRootElement(block: Block): Element | undefined {
  if (block instanceof Element) {
    return block
  }
  if (block instanceof VaporComponentInstance) {
    return getRootElement(block.block)
  }
  if (Array.isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const root = getRootElement(block[i] as Block)
      if (root) {
        return root
      }
    }
  }
}

/**
 * @internal
 */
export function validateComponentName(
  name: string,
  { isNativeTag }: AppConfig,
): void {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name,
    )
  }
}

// Vapor Component Instance
export class VaporComponentInstance {
  vapor = true
  uid: number
  type: VaporComponent
  root: VaporComponentInstance | null
  parent: VaporComponentInstance | null
  appContext: AppContext

  block: Block
  scope: EffectScope

  rawProps: RawProps
  rawSlots: RawSlots

  props: Readonly<any>
  attrs: Record<string, any>
  propsDefaults: Record<string, any> | null

  slots: StaticSlots

  scopeId?: string | null

  // to hold vnode props / slots in vdom interop mode
  rawPropsRef?: ShallowRef<any>
  rawSlotsRef?: ShallowRef<any>

  emit: EmitFn<Emits>
  emitted: Record<string, boolean> | null

  expose: (<T extends Record<string, any>>(exposed: T) => void) & string[]
  exposed: Record<string, any> | null
  exposeProxy: any | null

  // for useTemplateRef()
  refs: TypeRefs
  // for provide / inject
  provides: Record<string, any>
  // for useId
  ids: [string, number, number]
  // for suspense
  suspense: SuspenseBoundary | null
  suspenseId: number
  asyncDep: Promise<any> | null
  asyncResolved: boolean

  // for vapor custom element
  renderEffects?: RenderEffect[]

  hasFallthrough: boolean

  // for keep-alive
  shapeFlag?: number
  $key?: any

  // for v-once: caches props/attrs values to ensure they remain frozen
  // even when the component re-renders due to local state changes
  oncePropsCache?: Record<string | symbol, any>

  // lifecycle hooks
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  isUpdating: boolean

  bc?: LifecycleHook // LifecycleHooks.BEFORE_CREATE
  c?: LifecycleHook // LifecycleHooks.CREATED
  bm?: LifecycleHook // LifecycleHooks.BEFORE_MOUNT
  m?: LifecycleHook // LifecycleHooks.MOUNTED
  bu?: LifecycleHook // LifecycleHooks.BEFORE_UPDATE
  u?: LifecycleHook // LifecycleHooks.UPDATED
  um?: LifecycleHook // LifecycleHooks.BEFORE_UNMOUNT
  bum?: LifecycleHook // LifecycleHooks.UNMOUNTED
  da?: LifecycleHook // LifecycleHooks.DEACTIVATED
  a?: LifecycleHook // LifecycleHooks.ACTIVATED
  rtg?: LifecycleHook // LifecycleHooks.RENDER_TRACKED
  rtc?: LifecycleHook // LifecycleHooks.RENDER_TRIGGERED
  ec?: LifecycleHook // LifecycleHooks.ERROR_CAPTURED
  sp?: LifecycleHook<() => Promise<unknown>> // LifecycleHooks.SERVER_PREFETCH

  // dev only
  setupState?: Exposed extends Block ? undefined : ShallowUnwrapRef<Exposed>
  devtoolsRawSetupState?: any
  hmrRerender?: () => void
  hmrReload?: (newComp: VaporComponent) => void
  parentTeleport?: TeleportFragment | null
  propsOptions?: NormalizedPropsOptions
  emitsOptions?: ObjectEmitsOptions | null
  isSingleRoot?: boolean

  /**
   * dev only flag to track whether $attrs was used during render.
   * If $attrs was used during render then the warning for failed attrs
   * fallthrough can be suppressed.
   */
  accessedAttrs: boolean = false

  // type only
  /**
   * @deprecated only used for JSX to detect props types.
   */
  // @ts-expect-error
  $props: Props

  constructor(
    comp: VaporComponent,
    rawProps?: RawProps | null,
    rawSlots?: RawSlots | null,
    appContext?: AppContext,
  ) {
    this.expose = expose.bind(null, this)
    this.uid = uid++
    this.type = comp
    this.parent = currentInstance

    if (currentInstance) {
      // 其它任意组件的加载
      this.root = currentInstance.root
      this.appContext = currentInstance.appContext
      this.provides = currentInstance.provides
      // this.ids = currentInstance.ids
    } else {
      // 证明是在app加载
      this.root = this
      this.appContext = appContext || emptyContext
      this.provides = Object.create(this.appContext.provides)
      // this.ids = ['', 0, 0]
    }

    this.block = null! // to be set
    this.scope = new EffectScope(true)

    this.emit = ((event: string, ...args: any[]) => {
      const handler = (this.props as any)?.[`on${event}`]
      if (typeof handler === 'function') {
        handler(...args)
      }
    }) as any
    this.expose = expose.bind(null, this) as any
    this.refs = EMPTY_OBJ as TypeRefs
    this.emitted = this.exposed = this.exposeProxy = this.propsDefaults = null

    // suspense related
    // this.suspense = parentSuspense
    // this.suspenseId = parentSuspense ? parentSuspense.pendingId : 0
    // this.asyncDep = null
    // this.asyncResolved = false

    this.isMounted =
      this.isUnmounted =
      this.isUpdating =
      this.isDeactivated =
        false

    // init props
    this.rawProps = rawProps || EMPTY_OBJ
    this.attrs = EMPTY_OBJ
    this.props = this.rawProps as any
    // // this.hasFallthrough = hasFallthroughAttrs(comp, rawProps)
    // if (rawProps || comp.props) {
    //   const [propsHandlers, attrsHandlers] = getPropsProxyHandlers(comp, once)
    //   this.attrs = new Proxy(this, attrsHandlers)
    //   this.props = (
    //     comp.props
    //       ? new Proxy(this, propsHandlers!)
    //       : isFunction(comp)
    //         ? this.attrs
    //         : EMPTY_OBJ
    //   ) as Props
    // } else {
    //   this.props = this.attrs = EMPTY_OBJ as Props
    // }

    // init slots
    this.rawSlots = rawSlots || EMPTY_OBJ
    this.slots = this.rawSlots as any
    // this.slots = (
    //   rawSlots
    //     ? rawSlots.$
    //       ? new Proxy(rawSlots, dynamicSlotsProxyHandlers)
    //       : rawSlots
    //     : EMPTY_OBJ
    // ) as Slots

    // this.scopeId = getCurrentScopeId()
  }
}
