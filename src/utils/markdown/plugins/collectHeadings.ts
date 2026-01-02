import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { Element, Root } from 'hast'
import type { VFile } from 'vfile'

import { isHeading } from './helpers'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
}

const isTabsAncestor = (ancestor: Element) => {
  if (ancestor.type !== 'element') {
    console.log('skip')
    return false
  }

  if (ancestor.tagName !== 'md-comment-component') {
    console.log('skip')
    return false
  }

  const component = ancestor.properties?.['data-component']
  console.log('dont skip', component)
  return typeof component === 'string' && component.toLowerCase() === 'tabs'
}

export function rehypeCollectHeadings(
  _tree: Root,
  _file: VFile,
  initialHeadings?: MarkdownHeading[],
) {
  const headings = initialHeadings ?? []

  return function collectHeadings(tree: Root, file?: VFile) {
    visit(tree, 'element', (node: Element, _index, ancestors) => {
      if (!isHeading(node)) {
        return
      }

      if (Array.isArray(ancestors)) {
        const insideTabs = ancestors.some((ancestor) =>
          isTabsAncestor(ancestor as Element),
        )
        if (insideTabs) {
          return
        }
      }

      const id =
        typeof node.properties?.id === 'string' ? node.properties.id : ''
      if (!id) {
        return
      }

      headings.push({
        id,
        level: Number(node.tagName.substring(1)),
        text: toString(node).trim(),
      })
    })

    if (file) {
      file.data.headings = headings
    }
  }
}