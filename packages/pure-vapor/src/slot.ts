import { currentInstance } from './renderEffect'
import type { Block } from './types'

type VaporSlot = ((props?: any) => Block) & {
  _boundMap?: WeakMap<object, VaporSlot>
}

type RawSlots = Record<string, VaporSlot> & {
  $?: Array<Record<string, VaporSlot> | (() => any)>
}

let currentSlotOwner: any = null

function setCurrentSlotOwner(owner: any): any {
  const prev = currentSlotOwner
  currentSlotOwner = owner
  return prev
}

export function createSlot(
  name: string | (() => string),
  rawProps?: Record<string, unknown> | null,
  fallback?: (() => Block) | undefined,
  _noSlotted?: boolean,
  _once?: boolean,
): Block {
  // slot 解析优先使用显式 owner（withVaporCtx），否则回退到当前渲染实例。
  const owner = currentSlotOwner || currentInstance
  const slots = owner
    ? ((owner.rawSlots || owner.slots) as RawSlots)
    : undefined
  const slotName = typeof name === 'function' ? name() : name
  const slot = slots && resolveSlot(slots, slotName)
  if (slot) {
    return slot(rawProps || {})
  }
  if (fallback) {
    return fallback()
  }
  return []
}

export function withVaporCtx<T extends Function>(fn: T): T {
  const owner = currentSlotOwner || currentInstance
  // 包一层上下文，保证跨层调用 slot 时仍可定位到正确的 slot owner。
  const wrapped = ((...args: any[]) => {
    const prevOwner = setCurrentSlotOwner(owner)
    try {
      return fn(...args)
    } finally {
      setCurrentSlotOwner(prevOwner)
    }
  }) as unknown as T
  return wrapped
}

export function getSlot(slots: RawSlots, key: string): VaporSlot | undefined {
  const direct = slots[key]
  if (direct) {
    return direct
  }
  const dynamic = slots.$
  if (!dynamic) {
    return undefined
  }
  for (let i = dynamic.length - 1; i >= 0; i--) {
    // 逆序查找，后声明的动态 slot 覆盖先声明内容。
    const source = dynamic[i]
    if (typeof source === 'function') {
      const resolved = source()
      if (Array.isArray(resolved)) {
        for (let j = resolved.length - 1; j >= 0; j--) {
          const item = resolved[j]
          if (item && String(item.name) === key && item.fn) {
            return item.fn
          }
        }
      } else if (resolved && String(resolved.name) === key && resolved.fn) {
        return resolved.fn
      }
    } else if (source && source[key]) {
      return source[key]
    }
  }
}

function resolveSlot(slots: RawSlots, key: string): VaporSlot | undefined {
  return getSlot(slots, key)
}
