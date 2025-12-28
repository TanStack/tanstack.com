import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'

import { isHeading } from './helpers'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
}

export function rehypeCollectHeadings(
  tree,
  file,
  initialHeadings?: MarkdownHeading[],
) {
  const headings = initialHeadings ?? []

  return function collectHeadings(tree, file: any) {
    visit(tree, 'element', (node) => {
      if (!isHeading(node)) {
        return
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
