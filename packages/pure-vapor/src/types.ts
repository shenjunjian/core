import type { VaporComponentInstance } from './component'

// Vapor Component Types
export type VaporComponent =
  | FunctionalVaporComponent<any>
  | VaporComponentOptions

export type FunctionalVaporComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  Slots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
> = ((
  props: Props,
  ctx: {
    emit: EmitFn<Emits>
    slots: Slots
    attrs: Record<string, any>
    expose: <T extends Record<string, any> = Exposed>(exposed: T) => void
  },
) => Block) &
  Omit<
    VaporComponentOptions<ComponentPropsOptions<Props>, Emits, string, Slots>,
    'setup'
  > & {
    displayName?: string
  }

export interface VaporComponentOptions<
  Props = {},
  Emits extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  Slots extends StaticSlots = StaticSlots,
  Exposed extends Record<string, any> = Record<string, any>,
  TypeBlock extends Block = Block,
> {
  inheritAttrs?: boolean
  props?: Props
  emits?: Emits | RuntimeEmitsKeys[]
  slots?: Slots
  setup?: (
    props: Readonly<any>,
    ctx: {
      emit: EmitFn<Emits>
      slots: Slots
      attrs: Record<string, any>
      expose: <T extends Record<string, any> = Exposed>(exposed: T) => void
    },
  ) => TypeBlock | Exposed | Promise<Exposed> | void
  render?(
    ctx: Exposed extends Block ? undefined : any,
    props: Readonly<any>,
    emit: EmitFn<Emits>,
    attrs: any,
    slots: Slots,
  ): Block | void

  name?: string
  vapor?: boolean
  components?: Record<string, VaporComponent>
}

// Props and Slots Types
export type ComponentPropsOptions<P = {}> =
  | P
  | {
      [K in keyof P]: any
    }

export type EmitFn<E extends EmitsOptions = {}> = <K extends keyof E>(
  event: K,
  ...args: any[]
) => void

export type EmitsOptions = Record<string, any>

export type StaticSlots = Record<string, () => Block>
export type RawSlots =
  | Record<string, () => Block>
  | {
      $: Array<() => Record<string, () => Block>>
    }

export type RawProps =
  | Record<string, any>
  | {
      $: Array<() => Record<string, any>>
    }

// Block Types
export type Block = Node | VaporComponentInstance | Block[]
export type BlockFn = (...args: any[]) => Block

export interface AppConfig {
  performance?: boolean
  errorHandler?: (
    err: unknown,
    instance: VaporComponentInstance | null,
    info: string,
  ) => void
  warnHandler?: (
    msg: string,
    instance: VaporComponentInstance | null,
    trace: string,
  ) => void
  /**
   * Prefix for all useId() calls within this app
   */
  idPrefix?: string
  // @private
  readonly isNativeTag: (tag: string) => boolean
}

// App Types
export interface AppContext {
  app: App
  config: AppConfig
  components: Record<string, Component>
  directives: Record<string, Directive>
  mixins: ComponentOptions[]

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>
}

export interface App {
  _component: VaporComponent
  _props: any
  _container: ParentNode | null
  _instance: VaporComponentInstance | null
  mount: (container: ParentNode) => any
  unmount: () => void
  vapor: boolean
}

export type CreateAppFunction = (component: VaporComponent, props?: any) => App

export type LifecycleHook = Function | Function[]
