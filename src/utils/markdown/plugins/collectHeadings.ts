import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { Root } from 'hast'

import { isHeading } from './helpers'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
}

export const rehypeCollectHeadings = (headings: MarkdownHeading[]) => {
  return (tree: Root, file) => {
    visit(tree, 'element', (node) => {
      if (!isHeading(node)) {
        return
      }

      const id = typeof node.properties?.id === 'string' ? node.properties.id : ''
      if (!id) {
        return
      }

      headings.push({
        id,
        level: Number(node.tagName.substring(1)),
        text: toString(node).trim(),
      })
    })

    file.data.headings = headings
  }
}
