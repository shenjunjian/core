import { isBuiltInDirective } from '@vue/shared'
import { onScopeDispose } from '@vue/reactivity'
import { type Block } from './types'
import { currentInstance } from './renderEffect'
import { getRootElement, isVaporComponent } from './component'
import { warn } from './warning'

export function validateDirectiveName(name: string): void {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

export function resolveDirective(name: string): any {
  const instance = currentInstance
  if (!instance) {
    return undefined
  }
  const directives = instance.appContext.directives
  if (directives && directives[name]) {
    return directives[name]
  }
}

export function withVaporDirectives(
  block: Block,
  directives: Array<[any, any, string | undefined, Record<string, boolean>]>,
): Block {
  // 指令统一作用在“真实根元素”上；组件节点会先解引用到其根 DOM。
  const element = isVaporComponent(block)
    ? getRootElement(block.block)
    : getRootElement(block)
  if (!element) {
    __DEV__ &&
      warn(
        'Runtime directive used on component with non-element root node. The directives will not function as intended.',
      )
    return block
  }
  for (const item of directives) {
    const dir = item[0]
    const value = item[1]
    const arg = item[2]
    const modifiers = item[3] || {}
    if (!dir) continue
    if (typeof dir === 'function') {
      const cleanup = dir(element, value, arg, modifiers)
      // 把指令返回的清理函数绑定到当前作用域，组件卸载时自动调用。
      if (typeof cleanup === 'function') onScopeDispose(cleanup)
    } else if (typeof dir.mounted === 'function') {
      const cleanup = dir.mounted(element, { value, arg, modifiers })
      if (typeof cleanup === 'function') onScopeDispose(cleanup)
    }
  }
  return block
}

export function applyVShow(target: Block, source: () => unknown): void {
  const element = getRootElement(target)
  if (!element) {
    __DEV__ &&
      warn(
        'v-show used on component with non-single-element root node and will be ignored.',
      )
    return
  }
  const apply = () => {
    ;(element as HTMLElement).style.display = source() ? '' : 'none'
  }
  apply()
}

export function applyTextModel(
  el: HTMLInputElement | HTMLTextAreaElement,
  get: () => unknown,
  set: (value: unknown) => void,
  modifiers?: Record<string, true>,
): void {
  const toInput = (v: unknown) => (v == null ? '' : String(v))
  el.value = toInput(get())
  el.addEventListener('input', e => {
    const target = e.target as HTMLInputElement
    let value: unknown = target.value
    if (modifiers?.trim) value = target.value.trim()
    if (modifiers?.number) value = value === '' ? value : Number(value)
    set(value)
  })
}

export function applyRadioModel(
  el: HTMLInputElement,
  get: () => unknown,
  set: (value: unknown) => void,
  _modifiers?: Record<string, true>,
): void {
  el.checked = get() === el.value
  el.addEventListener('change', () => set(el.value))
}

export function applyCheckboxModel(
  el: HTMLInputElement,
  get: () => unknown,
  set: (value: unknown) => void,
  _modifiers?: Record<string, true>,
): void {
  const current = get()
  if (Array.isArray(current)) {
    el.checked = current.includes(el.value)
  } else {
    el.checked = Boolean(current)
  }
  el.addEventListener('change', () => {
    const model = get()
    if (Array.isArray(model)) {
      const next = model.slice()
      const index = next.indexOf(el.value)
      if (el.checked && index < 0) next.push(el.value)
      if (!el.checked && index >= 0) next.splice(index, 1)
      set(next)
      return
    }
    set(el.checked)
  })
}

export function applySelectModel(
  el: HTMLSelectElement,
  get: () => unknown,
  set: (value: unknown) => void,
  modifiers?: Record<string, true>,
): void {
  const value = get()
  if (el.multiple && Array.isArray(value)) {
    for (const option of Array.from(el.options)) {
      option.selected = value.includes(option.value)
    }
  } else if (value != null) {
    el.value = String(value)
  }
  el.addEventListener('change', () => {
    if (el.multiple) {
      const values = Array.from(el.selectedOptions).map(o =>
        modifiers?.number ? Number(o.value) : o.value,
      )
      set(values)
      return
    }
    set(modifiers?.number ? Number(el.value) : el.value)
  })
}

export function applyDynamicModel(
  el: Element,
  get: () => unknown,
  set: (value: unknown) => void,
  modifiers?: Record<string, true>,
): void {
  // 运行时按元素/输入类型分派到对应 v-model 处理器。
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      applyCheckboxModel(el, get, set, modifiers)
      return
    }
    if (el.type === 'radio') {
      applyRadioModel(el, get, set, modifiers)
      return
    }
    applyTextModel(el, get, set, modifiers)
    return
  }
  if (el instanceof HTMLTextAreaElement) {
    applyTextModel(el, get, set, modifiers)
    return
  }
  if (el instanceof HTMLSelectElement) {
    applySelectModel(el, get, set, modifiers)
  }
}
