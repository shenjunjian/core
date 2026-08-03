import { child, createTextNode } from './node'

let t: HTMLTemplateElement

/*@__NO_SIDE_EFFECTS__*/
export function template(html: string, root?: boolean) {
  let node: Node
  return (): Node & { $root?: true } => {
    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    if (!node) {
      t = t || document.createElement('template')
      t.innerHTML = html
      node = child(t.content)
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
