/**
 * Pure Vapor SSR stubs (CJS).
 * Keep App / import surface working in VitePress / Nuxt, but never render HTML.
 */

async function renderToString(_input, _context) {
  return ''
}

function renderToSimpleStream(_input, _context, stream) {
  Promise.resolve().then(() => {
    stream.push(null)
  })
  return stream
}

function renderToNodeStream(_input, _context) {
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

function pipeToNodeWritable(_input, _context, writable) {
  if (writable && typeof writable.end === 'function') {
    writable.end()
  }
}

function renderToWebStream(_input, _context) {
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

function pipeToWebWritable(_input, _context, writable) {
  if (writable && typeof writable.getWriter === 'function') {
    writable.getWriter().close()
  }
}

function renderToStream(input, context) {
  return renderToNodeStream(input, context)
}

function ssrRenderVNode() {}
function ssrRenderComponent() {
  return null
}
function ssrRenderSlot() {}
function ssrRenderSlotInner() {}
function ssrRenderTeleport() {}
function ssrRenderSuspense(_push, render) {
  if (typeof render === 'function') render()
}
function ssrRenderList() {}
function ssrRenderClass() {
  return ''
}
function ssrRenderStyle() {
  return ''
}
function ssrRenderAttrs() {
  return ''
}
function ssrRenderAttr() {
  return ''
}
function ssrRenderDynamicAttr() {
  return ''
}
function ssrInterpolate() {
  return ''
}
function ssrGetDirectiveProps() {
  return {}
}
function ssrIncludeBooleanAttr(value) {
  return !!value || value === ''
}
function ssrLooseEqual(a, b) {
  return a == b
}
function ssrLooseContain(list, value) {
  return Array.isArray(list) ? list.some(i => i == value) : false
}
function ssrRenderDynamicModel() {
  return ''
}
function ssrGetDynamicModelProps() {
  return null
}

module.exports = {
  renderToString,
  renderToSimpleStream,
  renderToNodeStream,
  pipeToNodeWritable,
  renderToWebStream,
  pipeToWebWritable,
  renderToStream,
  ssrRenderVNode,
  ssrRenderComponent,
  ssrRenderSlot,
  ssrRenderSlotInner,
  ssrRenderTeleport,
  ssrRenderSuspense,
  ssrRenderList,
  ssrRenderClass,
  ssrRenderStyle,
  ssrRenderAttrs,
  ssrRenderAttr,
  ssrRenderDynamicAttr,
  ssrInterpolate,
  ssrGetDirectiveProps,
  ssrIncludeBooleanAttr,
  ssrLooseEqual,
  ssrLooseContain,
  ssrRenderDynamicModel,
  ssrGetDynamicModelProps,
}
