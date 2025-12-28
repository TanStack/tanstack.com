import { visit } from 'unist-util-visit'
import type { Element } from 'hast'

import { normalizeComponentName } from './helpers'
import { transformTabsComponent } from './transformTabsComponent'

export const rehypeTransformCommentComponents = () => {
  return (tree) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'md-comment-component') {
        return
      }

      const component = String(node.properties?.['data-component'] ?? '')
      switch (normalizeComponentName(component)) {
        case 'tabs':
          transformTabsComponent(node)
          break
        default:
          break
      }
    })
  }
}
