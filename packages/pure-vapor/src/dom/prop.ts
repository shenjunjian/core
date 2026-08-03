import { toDisplayString } from '@vue/shared'
import type { Block } from '../types'

/**
 * Only called on text nodes!
 * Compiler should also ensure value passed here is already converted by
 * `toDisplayString`
 */
export function setText(el: Text & { $txt?: string }, value: string): void {
  if (el.$txt !== value) {
    el.nodeValue = el.$txt = value
  }
}

/**
 * Used by setDynamicProps only, so need to guard with `toDisplayString`
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
): void {
  value = toDisplayString(value)
  if (el.$txt !== value) {
    el.textContent = el.$txt = value as string
  }
}

export function setBlockText(
  block: Block & { $txt?: string },
  value: unknown,
): void {
  value = value == null ? '' : value
  if (block.$txt !== value) {
    setTextToBlock(block, (block.$txt = value as string))
  }
}

export function setHtml(
  el: Element & { $html?: string },
  value: unknown,
): void {
  const html = value == null ? '' : String(value)
  if (el.$html !== html) {
    el.innerHTML = html
    el.$html = html
  }
}

export function setBlockHtml(
  block: Block & { $html?: string },
  value: unknown,
): void {
  const html = value == null ? '' : String(value)
  if (block instanceof Element) {
    setHtml(block, html)
  }
}

export function setClass(
  el: Element & { $cls?: string },
  value: unknown,
): void {
  const cls = value == null ? '' : String(value)
  if (el.$cls !== cls) {
    el.className = cls
    el.$cls = cls
  }
}

export function setStyle(el: HTMLElement, value: unknown): void {
  if (typeof value === 'string') {
    el.style.cssText = value
    return
  }
  if (value && typeof value === 'object') {
    const style = value as Record<string, unknown>
    for (const key in style) {
      const current = style[key]
      ;(el.style as any)[key] = current == null ? '' : String(current)
    }
    return
  }
  el.removeAttribute('style')
}

export function setAttr(el: Element, key: string, value: unknown): void {
  if (value == null || value === false) {
    el.removeAttribute(key)
    return
  }
  el.setAttribute(key, value === true ? '' : String(value))
}

export function setValue(el: any, value: unknown): void {
  el.value = value == null ? '' : value
}

export function setDOMProp(el: any, key: string, value: unknown): void {
  if (value == null) {
    try {
      el[key] = ''
      return
    } catch (_e) {
      return
    }
  }
  el[key] = value
}

export function setProp(
  el: Element,
  key: string,
  value: unknown,
  prevValue?: unknown,
): void {
  if (key === 'class') {
    setClass(el as Element & { $cls?: string }, value)
    return
  }
  if (key === 'style') {
    setStyle(el as HTMLElement, value)
    return
  }
  if (key === 'value' && 'value' in (el as any)) {
    setValue(el as any, value)
    return
  }
  if (key in (el as any) && key !== 'list' && key !== 'type') {
    setDOMProp(el as any, key, value)
    return
  }
  if (prevValue !== value) {
    setAttr(el, key, value)
  }
}

export function setDynamicProps(
  el: Element,
  props: Record<string, unknown>,
  oldProps?: Record<string, unknown>,
): void {
  // 双向遍历：先应用新值，再把旧对象中已删除的字段置空/移除。
  for (const key in props) {
    setProp(el, key, props[key], oldProps ? oldProps[key] : undefined)
  }
  if (!oldProps) {
    return
  }
  for (const key in oldProps) {
    if (!(key in props)) {
      setProp(el, key, null, oldProps[key])
    }
  }
}

function setTextToBlock(block: Block, value: any): void {
  if (block instanceof Node) {
    if (block instanceof Element) {
      block.textContent = value
    }
  } else if (block instanceof Array) {
    // Do nothing for arrays
  }
}

let isOptimized = false

/**
 * Optimize property lookup for cache properties on Element and Text nodes
 */
export function optimizePropertyLookup(): void {
  if (isOptimized) return
  isOptimized = true
  const proto = Element.prototype as any
  proto.$transition = undefined
  proto.$key = undefined
  proto.$fc = proto.$evtclick = undefined
  proto.$root = false
  proto.$html = proto.$cls = proto.$sty = ''
  // Initialize $txt to undefined instead of empty string to ensure setText()
  // properly updates the text node even when the value is empty string.
  // This prevents issues where setText(node, '') would be skipped because
  // $txt === '' would return true, leaving the original nodeValue unchanged.
  ;(Text.prototype as any).$txt = undefined
}
