import { createVaporApp, createElement, createTextNode } from '../src'

// Test basic component creation and mounting
test('basic component mounting', () => {
  // Create a test container
  const container = document.createElement('div')
  document.body.appendChild(container)

  // Create a simple component
  const App = () => {
    const div = createElement('div')
    const text = createTextNode('Hello, Pure Vapor!')
    div.appendChild(text)
    return div
  }

  // Create and mount the app
  const app = createVaporApp(App)
  const instance = app.mount(container)

  // Verify the component is mounted
  expect(container.innerHTML).toBe('<div>Hello, Pure Vapor!</div>')
  expect(instance).toBeDefined()

  // Unmount the app
  app.unmount()
  expect(container.innerHTML).toBe('')

  // Clean up
  document.body.removeChild(container)
})

// Test component with props
test('component with props', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const Greeting = (props: { name: string }) => {
    const div = createElement('div')
    const text = createTextNode(`Hello, ${props.name}!`)
    div.appendChild(text)
    return div
  }

  const app = createVaporApp(Greeting, { name: 'World' })
  app.mount(container)

  expect(container.innerHTML).toBe('<div>Hello, World!</div>')

  app.unmount()
  document.body.removeChild(container)
})
