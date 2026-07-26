import {
  createSSRApp,
  createVaporApp,
  createVaporSSRApp,
  onServerPrefetch,
  ssrContextKey,
  useSSRContext,
} from '../src/index.js'
import {
  pipeToNodeWritable,
  renderToString,
  renderToWebStream,
  ssrInterpolate,
  ssrRenderAttrs,
  ssrRenderComponent,
} from '../server-renderer/index.mjs'

describe('pure-vapor SSR stubs', () => {
  test('createVaporSSRApp returns a mountable App (same as createVaporApp)', () => {
    const app = createVaporSSRApp({
      setup() {
        return document.createElement('div')
      },
    })
    expect(app.vapor).toBe(true)
    expect(typeof app.mount).toBe('function')
    expect(typeof app.use).toBe('function')
    expect(typeof app.provide).toBe('function')
    expect(createSSRApp).toBe(createVaporSSRApp)
    expect(createVaporSSRApp).toBe(createVaporApp)
  })

  test('renderToString resolves to empty string without walking the tree', async () => {
    let setupCalled = false
    const app = createSSRApp({
      setup() {
        setupCalled = true
        return document.createElement('div')
      },
    })
    await expect(renderToString(app)).resolves.toBe('')
    expect(setupCalled).toBe(false)
  })

  test('stream helpers end/close without throwing', async () => {
    const app = createSSRApp({})
    const chunks = []
    const writable = {
      write(c) {
        chunks.push(c)
      },
      end() {
        chunks.push(null)
      },
      destroy() {},
    }
    pipeToNodeWritable(app, {}, writable)
    expect(chunks).toEqual([null])

    if (typeof ReadableStream === 'function') {
      const stream = renderToWebStream(app)
      const reader = stream.getReader()
      const first = await reader.read()
      expect(first.done).toBe(true)
    }
  })

  test('compiler-ssr helper names are importable noops', () => {
    expect(ssrInterpolate('x')).toBe('')
    expect(ssrRenderAttrs()).toBe('')
    expect(ssrRenderComponent()).toBe(null)
  })

  test('ssrContextKey / useSSRContext / onServerPrefetch are exported', () => {
    expect(typeof ssrContextKey).toBe('symbol')
    expect(typeof useSSRContext).toBe('function')
    expect(typeof onServerPrefetch).toBe('function')
  })
})
