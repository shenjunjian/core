import { camelize, toHandlerKey } from '@vue/shared'
import { hyphenate } from '@vue/shared'

type EventValue =
  | EventListener
  | EventListenerObject
  | EventListener[]
  | null
  | undefined

export function createInvoker(value: EventValue): EventListener {
  const invoker: EventListener = (e: Event) => {
    if (!invoker.value) {
      return
    }
    if (Array.isArray(invoker.value)) {
      for (const fn of invoker.value) {
        ;(fn as EventListener)(e)
      }
      return
    }
    ;(invoker.value as EventListener)(e)
  }
  ;(invoker as any).value = value
  return invoker
}

export function on(
  el: Element,
  event: string,
  value: EventValue,
  options?: AddEventListenerOptions & { effect?: boolean },
): void {
  // 每个元素按事件名缓存 invoker，后续更新只替换 invoker.value，避免重复绑/解绑。
  const store = ((el as any)._vei ||= Object.create(null))
  let invoker = store[event] as EventListener | undefined
  if (value) {
    if (!invoker) {
      invoker = store[event] = createInvoker(value)
      el.addEventListener(event, invoker, options)
    } else {
      ;(invoker as any).value = value
    }
    return
  }
  if (invoker) {
    el.removeEventListener(event, invoker, options)
    store[event] = undefined
  }
}

export function delegate(el: any, event: string, handler: EventListener): void {
  const key = `$evt${event}`
  const existing = el[key]
  if (!existing) {
    el[key] = handler
    return
  }
  if (Array.isArray(existing)) {
    existing.push(handler)
  } else {
    el[key] = [existing, handler]
  }
}

export function delegateEvents(...events: string[]): void {
  const delegated = ((document as any)._vaporDelegatedEvents ||=
    Object.create(null))
  for (const event of events) {
    if (delegated[event]) {
      continue
    }
    delegated[event] = true
    // 在 document 上监听一次，通过冒泡链分发到节点上缓存的 `$evt*` 处理器。
    document.addEventListener(event, e => {
      let target = ((e.composedPath && e.composedPath()[0]) || e.target) as any
      Object.defineProperty(e, 'currentTarget', {
        configurable: true,
        get() {
          return target || document
        },
      })
      while (target) {
        const handlers = target[`$evt${event}`]
        if (Array.isArray(handlers)) {
          for (const fn of handlers) {
            if (!target.disabled) {
              fn(e)
              if (e.cancelBubble) return
            }
          }
        } else if (typeof handlers === 'function') {
          if (!target.disabled) {
            handlers(e)
            if (e.cancelBubble) return
          }
        }
        target =
          target.host && target.host !== target && target.host instanceof Node
            ? target.host
            : target.parentNode
      }
    })
  }
}

export function setDynamicEvents(
  el: Element,
  events: Record<string, EventValue>,
): void {
  for (const key in events) {
    on(el, key, events[key], { effect: true })
  }
}

export function toHandlers(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const ret: Record<string, unknown> = {}
  if (!source) {
    return ret
  }
  for (const key in source) {
    ret[toHandlerKey(camelize(key))] = source[key]
  }
  return ret
}

export function withKeys<T extends Function>(fn: T, _keys: string[]): T {
  const keyMap: Record<string, string> = {
    esc: 'escape',
    space: ' ',
    up: 'arrow-up',
    left: 'arrow-left',
    right: 'arrow-right',
    down: 'arrow-down',
    delete: 'backspace',
  }
  return ((event: KeyboardEvent) => {
    if (!('key' in event)) {
      return
    }
    const eventKey = hyphenate(event.key)
    for (let i = 0; i < _keys.length; i++) {
      const key = _keys[i]
      if (key === eventKey || keyMap[key] === eventKey) {
        return (fn as any)(event)
      }
    }
  }) as unknown as T
}

export function withModifiers<T extends Function>(
  fn: T,
  modifiers: string[],
): T {
  const guards: Record<string, (e: Event, mods: string[]) => any> = {
    stop: e => e.stopPropagation(),
    prevent: e => e.preventDefault(),
    self: e => e.target !== e.currentTarget,
    ctrl: e => !(e as KeyboardEvent).ctrlKey,
    shift: e => !(e as KeyboardEvent).shiftKey,
    alt: e => !(e as KeyboardEvent).altKey,
    meta: e => !(e as KeyboardEvent).metaKey,
    left: e => 'button' in e && (e as MouseEvent).button !== 0,
    middle: e => 'button' in e && (e as MouseEvent).button !== 1,
    right: e => 'button' in e && (e as MouseEvent).button !== 2,
    exact: (e, mods) => {
      const keys = ['ctrl', 'shift', 'alt', 'meta']
      return keys.some(k => (e as any)[`${k}Key`] && !mods.includes(k))
    },
  }
  return ((event: Event, ...args: any[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = guards[modifiers[i]]
      if (guard && guard(event, modifiers)) {
        return
      }
    }
    return (fn as any)(event, ...args)
  }) as unknown as T
}
