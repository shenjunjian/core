import type { App, AppContext, CreateAppFunction } from './types'
import {
  createComponent,
  getExposed,
  mountComponent,
  unmountComponent,
  validateComponentName,
  VaporComponentInstance,
} from './component'
import { NO, isFunction, isString } from '@vue/shared'
import { version } from './index'
import { warn } from './warning'
import { validateDirectiveName } from './directives'
import { ErrorCodes, callWithAsyncErrorHandling } from './errorHandling'

// @internal
let uid = 0

export const createVaporApp: CreateAppFunction = (component, props = null) => {
  const appContext: AppContext = {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      errorHandler: undefined,
      warnHandler: undefined,
    },
    components: {},
    directives: {},
    provides: Object.create(null),
    // optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  }
  const installedPlugins = new WeakSet()
  const pluginCleanupFns: Array<() => any> = []

  let isMounted = false

  const app: App = (appContext.app = {
    _uid: uid++,
    _component: component,
    _props: props,
    _container: null,
    _context: appContext,
    _instance: null,
    version,
    use(plugin, ...options: any[]) {
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
    component(name: string, component?: Component): any {
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

    directive(name: string, directive?: Directive) {
      if (__DEV__) {
        validateDirectiveName(name)
      }

      if (!directive) {
        return context.directives[name] as any
      }
      if (__DEV__ && context.directives[name]) {
        warn(`Directive "${name}" has already been registered in target app.`)
      }
      context.directives[name] = directive
      return app
    },
    mount(_container: string | HTMLElement) {
      let container
      if (!isMounted) {
        container = isString(_container)
          ? document.querySelector(_container)
          : _container
        if (container.nodeType === 1 /* Node.ELEMENT_NODE */) {
          container.textContent = ''
        }
        const instance = createComponent(component, props, null, appContext)
        app._instance = instance
        app._container = container
        const proxy = getExposed(instance)

        mountComponent(instance, container)

        isMounted = true
        if (container instanceof Element) {
          container.removeAttribute('v-cloak')
          container.setAttribute('data-v-app', '')
        }
        return proxy
      }
    },
    onUnmount(cleanupFn: () => void) {
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
        unmountComponent(
          app._instance as VaporComponentInstance,
          app._container! as ParentNode,
        )
        app._instance = null
      } else if (__DEV__) {
        warn(`Cannot unmount an app that is not mounted.`)
      }
    },
  })

  return app
}
