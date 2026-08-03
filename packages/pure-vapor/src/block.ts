import { isArray } from '@vue/shared'
import type { Block } from './types'
import {
  VaporComponentInstance,
  mountComponent,
  unmountComponent,
} from './component'

type InsertionState = {
  parent: ParentNode | null
  anchor: Node | null
}

// 编译产物很多场景不会显式传 parent/anchor，统一从这里兜底读取。
let insertionState: InsertionState = {
  parent: null,
  anchor: null,
}

export function setInsertionState(
  parent: ParentNode | null,
  anchor: Node | null = null,
): void {
  insertionState.parent = parent
  insertionState.anchor = anchor
}

function resolveParent(parent: ParentNode | null | undefined): ParentNode {
  if (parent) {
    return parent
  }
  if (insertionState.parent) {
    return insertionState.parent
  }
  throw new Error('[pure-vapor] missing insertion parent')
}

export function insert(
  block: Block,
  parent?: ParentNode | null,
  anchor: Node | null = null,
): void {
  const target = resolveParent(parent)
  const resolvedAnchor = anchor === null ? insertionState.anchor : anchor
  // Block 是一个递归结构：Node / 组件实例 / Block[]，统一在这里展开插入。
  if (block instanceof Node) {
    target.insertBefore(block, resolvedAnchor)
  } else if (block instanceof VaporComponentInstance) {
    // 组件首次插入时执行 mount，后续复用其 block 做移动。
    if (block.isMounted) {
      insert(block.block, target, resolvedAnchor)
    } else {
      mountComponent(block, target, resolvedAnchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, target, resolvedAnchor)
    }
  }
}

export function prepend(block: Block, parent?: ParentNode | null): void {
  const target = resolveParent(parent)
  const first = target.firstChild
  insert(block, target, first)
}

export function remove(block: Block, parent?: ParentNode): void {
  // 与 insert 对称：按 Block 的实际形态递归卸载/移除。
  if (block instanceof Node) {
    parent && parent.removeChild(block)
  } else if (block instanceof VaporComponentInstance) {
    unmountComponent(block, parent)
  } else if (isArray(block)) {
    for (const b of block) {
      remove(b, parent)
    }
  }
}

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node || isArray(val) || val instanceof VaporComponentInstance
  )
}
