import type { Block } from './types'
import { currentInstance, renderEffect } from './renderEffect'
import { insert, remove } from './block'
import { createComment } from './dom/node'

export function createIf(
  condition: () => unknown,
  positive: () => Block,
  negative?: () => Block,
  _blockShape?: number,
  once?: boolean,
  _index?: number,
): Block {
  if (once) {
    return condition() ? positive() : negative ? negative() : []
  }

  // 用注释锚点包裹分支内容，后续更新时始终在 start/end 之间做替换。
  const start = __DEV__ ? createComment('if-start') : createComment('')
  const end = __DEV__ ? createComment('if-end') : createComment('')
  let current = condition() ? positive() : negative ? negative() : []

  const block: Block = [start, current, end]
  renderEffect(() => {
    const next = condition() ? positive() : negative ? negative() : []
    if (next === current) {
      return
    }
    const parent = end.parentNode
    if (!parent) {
      current = next
      return
    }
    remove(current, parent)
    current = next
    insert(current, parent, end)
  })

  return block
}

export function createKeyedFragment(
  key: () => unknown,
  render: () => Block,
): Block & { $key?: unknown } {
  // keyed-fragment 的语义是 key 变化就整段替换。
  const start = __DEV__ ? createComment('keyed-start') : createComment('')
  const end = __DEV__ ? createComment('keyed-end') : createComment('')
  let currentKey = key()
  let current = render()
  const root: Block[] = [start, current, end]
  ;(root as any).$key = currentKey

  renderEffect(() => {
    const nextKey = key()
    if (nextKey === currentKey) {
      return
    }
    const parent = end.parentNode
    const next = render()
    if (!parent) {
      currentKey = nextKey
      current = next
      ;(root as any).$key = nextKey
      return
    }
    remove(current, parent)
    current = next
    currentKey = nextKey
    ;(root as any).$key = nextKey
    insert(current, parent, end)
  })

  return root as Block & { $key?: unknown }
}

type ItemRef<T> = { value: T }

export function createFor<T>(
  source: () => Iterable<T> | ArrayLike<T> | Record<string, T> | number | null,
  render: (
    value: ItemRef<T>,
    key: ItemRef<any>,
    index: ItemRef<number | undefined>,
  ) => Block,
  getKey?: (item: T, key: any, index?: number) => any,
  _flags?: number,
  _setup?: unknown,
): Block[] {
  const start = __DEV__ ? createComment('for-start') : createComment('')
  const end = __DEV__ ? createComment('for-end') : createComment('')
  const root: Block[] = [start, end]
  let entries = buildEntries(source(), render, getKey)

  if (entries.length) {
    root.splice(1, 0, ...entries.map(e => e.block))
  }

  renderEffect(() => {
    const parent = end.parentNode
    const nextEntries = buildEntries(source(), render, getKey)

    if (!parent) {
      entries = nextEntries
      root.splice(1, root.length - 2, ...entries.map(e => e.block))
      return
    }

    if (getKey) {
      // keyed diff：复用同 key 旧节点，仅对新增/删除和最终顺序做处理。
      const oldMap = new Map<any, { entry: ForEntry; used: boolean }>()
      for (let i = 0; i < entries.length; i++) {
        oldMap.set(entries[i].renderKey, { entry: entries[i], used: false })
      }

      for (let i = 0; i < nextEntries.length; i++) {
        const next = nextEntries[i]
        const reused = oldMap.get(next.renderKey)
        if (reused) {
          reused.used = true
          reused.entry.itemRef.value = next.itemRef.value
          reused.entry.keyRef.value = next.keyRef.value
          reused.entry.indexRef.value = next.indexRef.value
          next.itemRef = reused.entry.itemRef
          next.keyRef = reused.entry.keyRef
          next.indexRef = reused.entry.indexRef
          next.block = reused.entry.block
        } else {
          insert(next.block, parent, end)
        }
      }

      for (const [, old] of oldMap) {
        if (!old.used) {
          remove(old.entry.block, parent)
        }
      }

      let anchor: Node = end
      // 倒序插入可直接得到正确顺序，anchor 始终指向“当前片段头节点”。
      for (let i = nextEntries.length - 1; i >= 0; i--) {
        const block = nextEntries[i].block
        insert(block, parent, anchor)
        anchor = firstNode(block) || anchor
      }
    } else {
      // unkeyed 策略：整段重建，逻辑简单且与编译期预期一致。
      for (let i = 0; i < entries.length; i++) {
        remove(entries[i].block, parent)
      }
      for (let i = 0; i < nextEntries.length; i++) {
        insert(nextEntries[i].block, parent, end)
      }
    }

    entries = nextEntries
    root.splice(1, root.length - 2, ...entries.map(e => e.block))
  })

  return root
}

type ForEntry = {
  itemRef: ItemRef<any>
  keyRef: ItemRef<any>
  indexRef: ItemRef<number | undefined>
  block: Block
  renderKey: any
}

function buildEntries<T>(
  rawSource: Iterable<T> | ArrayLike<T> | Record<string, T> | number | null,
  render: (
    value: ItemRef<T>,
    key: ItemRef<any>,
    index: ItemRef<number | undefined>,
  ) => Block,
  getKey?: (item: T, key: any, index?: number) => any,
): ForEntry[] {
  if (rawSource == null) {
    return []
  }
  const normalized = normalizeForSource(rawSource)
  const ret: ForEntry[] = []
  for (let i = 0; i < normalized.values.length; i++) {
    const item = normalized.values[i]
    const key = normalized.keys ? normalized.keys[i] : i
    const itemRef = { value: item }
    const keyRef = { value: key }
    const indexRef = { value: i }
    const block = render(itemRef, keyRef, indexRef)
    const renderKey = getKey ? getKey(item, key, i) : i
    // 统一把 key 写到 block 上，便于后续 keyed 逻辑和调试查看。
    ;(block as any).$key = renderKey
    ret.push({ itemRef, keyRef, indexRef, block, renderKey })
  }
  return ret
}

function firstNode(block: Block): Node | null {
  if (block instanceof Node) return block
  if (Array.isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const n = firstNode(block[i])
      if (n) return n
    }
  } else {
    return firstNode(block.block)
  }
  return null
}

export function createForSlots<T>(
  source: Iterable<T> | ArrayLike<T> | Record<string, T> | number | null,
  getSlot: (value: T, key: any, index?: number) => any,
): any[] {
  if (source == null) {
    return []
  }
  const normalized = normalizeForSource(source)
  const slots = new Array(normalized.values.length)
  for (let i = 0; i < normalized.values.length; i++) {
    const key = normalized.keys ? normalized.keys[i] : i
    slots[i] = getSlot(normalized.values[i], key, i)
  }
  return slots
}

export function getRestElement(
  source: Record<string, unknown>,
  removed: string[],
): Record<string, unknown> {
  const ret: Record<string, unknown> = {}
  for (const key in source) {
    if (removed.includes(key)) {
      continue
    }
    ret[key] = source[key]
  }
  return ret
}

export function getDefaultValue<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value
}

export function createTemplateRefSetter() {
  const instance = currentInstance
  return function setRef(
    el: unknown,
    ref: any,
    refFor?: boolean,
    refKey?: string,
  ): void {
    if (!instance) {
      return
    }
    const refs = instance.refs || (instance.refs = {})
    const value = el && (el as any).vapor ? (el as any).exposed || el : el
    if (typeof ref === 'function') {
      ref(value, refs)
      return
    }
    if (ref && typeof ref === 'object' && 'value' in ref) {
      if (refFor) {
        if (!Array.isArray((ref as any).value)) {
          ;(ref as any).value = value == null ? [] : [value]
        } else if (value != null) {
          ;(ref as any).value.push(value)
        }
      } else {
        ;(ref as any).value = value
      }
      if (refKey) {
        refs[refKey] = (ref as any).value
      }
      return
    }
    const key = String(ref)
    if (refFor) {
      const existing = refs[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else if (existing != null) {
        refs[key] = [existing, value]
      } else {
        refs[key] = [value]
      }
      return
    }
    refs[key] = value
  }
}

function normalizeForSource<T>(
  source: Iterable<T> | ArrayLike<T> | Record<string, T> | number,
): { values: T[]; keys?: string[] } {
  if (typeof source === 'number') {
    // `v-for="n in number"` 语义：生成 [1...n]。
    const values = new Array(source) as T[]
    for (let i = 0; i < source; i++) {
      values[i] = (i + 1) as unknown as T
    }
    return { values }
  }
  if (Array.isArray(source) || typeof (source as any).length === 'number') {
    return { values: Array.from(source as ArrayLike<T>) }
  }
  if ((source as any)[Symbol.iterator]) {
    return { values: Array.from(source as Iterable<T>) }
  }
  const keys = Object.keys(source)
  const values = new Array(keys.length) as T[]
  for (let i = 0; i < keys.length; i++) {
    values[i] = (source as Record<string, T>)[keys[i]]
  }
  return { values, keys }
}

export function setBlockKey<T extends Block>(
  block: T & { $key?: unknown },
  key: unknown,
): T {
  block.$key = key
  return block
}
