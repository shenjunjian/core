import { inject } from './apiInject.js'
import { warn } from './warning.js'

/** Same key as @vue/runtime-core — keep Symbol.for for cross-realm / framework interop. */
export const ssrContextKey = Symbol.for('v-scx')

/**
 * Stub: Pure Vapor has no real SSR context pipeline.
 * Returns whatever was provided under ssrContextKey, or undefined.
 */
export function useSSRContext() {
  const ctx = inject(ssrContextKey, undefined)
  if (__DEV__ && !ctx) {
    warn(
      `Server rendering context not provided. Make sure to only call ` +
        `useSSRContext() conditionally in the server build.`,
    )
  }
  return ctx
}
