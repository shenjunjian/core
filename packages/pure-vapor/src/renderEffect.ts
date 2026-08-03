import { EffectFlags, ReactiveEffect } from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import type { VaporComponentInstance } from './component'

export let currentInstance: VaporComponentInstance | null = null

export function setCurrentInstance(
  instance: VaporComponentInstance | null,
): VaporComponentInstance | null {
  const prev = currentInstance
  currentInstance = instance
  return prev
}

export class RenderEffect extends ReactiveEffect {
  i: VaporComponentInstance | null

  constructor(public render: () => void) {
    super()
    const instance = currentInstance

    this.i = instance

    // Allow self re-queue when render/hook logic mutates reactive state
    this.flags |= EffectFlags.ALLOW_RECURSE
  }

  fn(): void {
    const instance = this.i
    const hasUpdateHooks = instance && (instance.bu || instance.u)
    const prev = setCurrentInstance(instance)
    if (hasUpdateHooks && instance!.isMounted && !instance!.isUpdating) {
      // avoid recurse update until updateJob flushed
      instance!.isUpdating = true
      instance!.bu && invokeArrayFns(instance!.bu)
      this.render()
      instance!.isUpdating = false
      instance!.u && invokeArrayFns(instance!.u)
    } else {
      this.render()
    }
    setCurrentInstance(prev)
  }

  notify(): void {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      this.run()
    }
  }
}

export function renderEffect(fn: () => void): void {
  const effect = new RenderEffect(fn)
  effect.run()
}
