import {
  extend,
  getGlobalThis,
  hasOwn,
  isFunction,
  isObject,
} from '@vue/shared'
import {
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
} from './component.js'
import {
  createAppContext,
  normalizeContainer,
  runWithAppContext,
  validateComponentName,
  validateDirectiveName,
} from '../internal/app.js'
import {
  ErrorCodes,
  callWithAsyncErrorHandling,
} from '../internal/errorHandling.js'
import { flushOnAppMount } from '../internal/scheduler.js'
import { warn } from '../internal/warning.js'
import { optimizePropertyLookup } from './dom/prop.js'

let uid = 0

export function createVaporApp(rootComponent, rootProps = null) {
  if (!isFunction(rootComponent)) {
    // 不污染用户导出的原始对象， 与 HMR / 热更新兼容,可能与SSR兼容
    rootComponent = extend({}, rootComponent)
  }

  if (rootProps != null && !isObject(rootProps)) {
    __DEV__ && warn(`root props passed to app.mount() must be an object.`)
    rootProps = null
  }

  const context = createAppContext()
  const installedPlugins = new WeakSet()
  const pluginCleanupFns = []

  let isMounted = false

  const app = (context.app = {
    vapor: true,
    _uid: uid++,
    _component: rootComponent,
    _props: rootProps,
    _container: null,
    _context: context,
    _instance: null,

    version: __VERSION__,

    get config() {
      return context.config
    },

    set config(v) {
      if (__DEV__) {
        warn(
          `app.config cannot be replaced. Modify individual options instead.`,
        )
      }
    },

    use(plugin, ...options) {
      if (installedPlugins.has(plugin)) {
        __DEV__ && warn(`Plugin has already been applied to target app.`)
      } else if (plugin && isFunction(plugin.install)) {
        installedPlugins.add(plugin)
        plugin.install(app, ...options)
      } else if (isFunction(plugin)) {
        installedPlugins.add(plugin)
        plugin(app, ...options)
      } else if (__DEV__) {
        warn(
          `A plugin must either be a function or an object with an "install" ` +
            `function.`,
        )
      }
      return app
    },

    component(name, component) {
      if (__DEV__) {
        validateComponentName(name, context.config)
      }
      if (!component) {
        return context.components[name]
      }
      if (__DEV__ && context.components[name]) {
        warn(`Component "${name}" has already been registered in target app.`)
      }
      context.components[name] = component
      return app
    },

    directive(name, directive) {
      if (__DEV__) {
        validateDirectiveName(name)
      }

      if (!directive) {
        return context.directives[name]
      }
      if (__DEV__ && context.directives[name]) {
        warn(`Directive "${name}" has already been registered in target app.`)
      }
      context.directives[name] = directive
      return app
    },

    provide(key, value) {
      if (__DEV__ && key in context.provides) {
        if (hasOwn(context.provides, key)) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`,
          )
        } else {
          warn(
            `App already provides property with key "${String(key)}" inherited from its parent element. ` +
              `It will be overwritten with the new value.`,
          )
        }
      }

      context.provides[key] = value

      return app
    },

    mount(container) {
      container = normalizeContainer(container)
      if (!isMounted) {
        if (__DEV__ && container && container.__vue_app__) {
          warn(
            `There is already an app instance mounted on the host container.\n` +
              ` If you want to mount another app on the same host container,` +
              ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
          )
        }
        let instance
        optimizePropertyLookup()

        if (container.nodeType === 1) {
          if (__DEV__ && container.childNodes.length) {
            warn('mount target container is not empty and will be cleared.')
          }
          container.textContent = ''
        }

        instance =
          app._ceComponent ||
          createComponent(
            app._component,
            app._props,
            null,
            false,
            false,
            app._context,
          )
        // instance.block 存的是「渲染产物」，子组件在挂载前会以 子组件 instance 的形式出现在父 block 里。
        // 只有叶子组件，才显示的是真实的block
        mountComponent(instance, container)
        flushOnAppMount()
        app._instance = instance
        isMounted = true
        app._container = container
        if (__DEV__) {
          context.reload = () => {
            const target = app._container
            if (!target) {
              return
            }
            app.unmount()
            app.mount(target)
          }
        }
        if (container) {
          container.__vue_app__ = app
          if (container instanceof Element) {
            container.removeAttribute('v-cloak') // 建议手写在这里，框架负责删除： <div id="app" v-cloak></div>
            container.setAttribute('data-v-app', '')
          }
        }
        return getExposed(instance)
      } else if (__DEV__) {
        warn(
          `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``,
        )
      }
    },

    onUnmount(cleanupFn) {
      if (__DEV__ && typeof cleanupFn !== 'function') {
        warn(
          `Expected function as first argument to app.onUnmount(), ` +
            `but got ${typeof cleanupFn}`,
        )
      }
      pluginCleanupFns.push(cleanupFn)
    },

    unmount() {
      if (isMounted) {
        callWithAsyncErrorHandling(
          pluginCleanupFns,
          app._instance,
          ErrorCodes.APP_UNMOUNT_CLEANUP,
        )
        unmountComponent(app._instance, app._container)
        app._instance = null
        isMounted = false
        if (app._container) {
          delete app._container.__vue_app__
          app._container = null
        }
      } else if (__DEV__) {
        warn(`Cannot unmount an app that is not mounted.`)
      }
    },

    runWithContext(fn) {
      return runWithAppContext(app, fn)
    },
  })

  return app
}

/**
 * SSR stub: same App shape as createVaporApp (CSR mount).
 * Real hydration is not implemented — client mount clears & remounts.
 */
export const createVaporSSRApp = createVaporApp
