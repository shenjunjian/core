/**
 * Pure Vapor SSR stubs.
 * Keep App / import surface working in VitePress / Nuxt, but never render HTML.
 * Client apps should CSR-mount via createVaporSSRApp (= createVaporApp).
 */

export async function renderToString(_input, _context = {}) {
  return ''
}

export function renderToSimpleStream(_input, _context, stream) {
  Promise.resolve().then(() => {
    stream.push(null)
  })
  return stream
}

export function renderToNodeStream(_input, _context = {}) {
  return {
    pipe(writable) {
      Promise.resolve().then(() => {
        if (writable && typeof writable.end === 'function') {
          writable.end()
        }
      })
      return writable
    },
    on() {
      return this
    },
    once() {
      return this
    },
    destroy() {},
  }
}

export function pipeToNodeWritable(_input, _context = {}, writable) {
  if (writable && typeof writable.end === 'function') {
    writable.end()
  }
}

export function renderToWebStream(_input, _context = {}) {
  if (typeof ReadableStream !== 'function') {
    throw new Error(
      `[pure-vapor/server-renderer] ReadableStream is not available.`,
    )
  }
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

export function pipeToWebWritable(_input, _context = {}, writable) {
  if (writable && typeof writable.getWriter === 'function') {
    writable.getWriter().close()
  }
}

/** @deprecated */
export function renderToStream(input, context) {
  return renderToNodeStream(input, context)
}

// ---------------------------------------------------------------------------
// compiler-ssr runtime helpers (import-only stubs; renderToString never calls them)
// ---------------------------------------------------------------------------

export function ssrRenderVNode() {}
export function ssrRenderComponent() {
  return null
}
export function ssrRenderSlot() {}
export function ssrRenderSlotInner() {}
export function ssrRenderTeleport() {}
export function ssrRenderSuspense(_push, render) {
  if (typeof render === 'function') render()
}
export function ssrRenderList() {}
export function ssrRenderClass() {
  return ''
}
export function ssrRenderStyle() {
  return ''
}
export function ssrRenderAttrs() {
  return ''
}
export function ssrRenderAttr() {
  return ''
}
export function ssrRenderDynamicAttr() {
  return ''
}
export function ssrInterpolate() {
  return ''
}
export function ssrGetDirectiveProps() {
  return {}
}
export function ssrIncludeBooleanAttr(value) {
  return !!value || value === ''
}
export function ssrLooseEqual(a, b) {
  return a == b
}
export function ssrLooseContain(list, value) {
  return Array.isArray(list) ? list.some(i => i == value) : false
}
export function ssrRenderDynamicModel() {
  return ''
}
export function ssrGetDynamicModelProps() {
  return null
}
