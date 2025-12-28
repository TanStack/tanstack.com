import { SKIP, visit } from 'unist-util-visit'
import type { Root } from 'hast'

import {
  COMPONENT_PREFIX,
  END_PREFIX,
  START_PREFIX,
  isCommentNode,
  normalizeComponentName,
  parseDescriptor,
} from './helpers'

export const rehypeParseCommentComponents = () => {
  return (tree: Root) => {
    visit(tree, 'comment', (node, index, parent) => {
      if (!isCommentNode(node) || parent == null || typeof index !== 'number') {
        return
      }

      const trimmed = node.value.trim()
      if (!trimmed.startsWith(COMPONENT_PREFIX)) {
        return
      }

      const isBlock = trimmed.startsWith(START_PREFIX)
      const descriptor = isBlock
        ? trimmed.slice(START_PREFIX.length)
        : trimmed.slice(COMPONENT_PREFIX.length)

      const parsed = parseDescriptor(descriptor)
      if (!parsed) {
        return
      }

      const componentName = parsed.component
      const element = {
        type: 'element',
        tagName: 'md-comment-component',
        properties: {
          'data-component': componentName,
          'data-attributes': JSON.stringify(parsed.attributes ?? {}),
        },
        children: [] as any[],
      }

      if (!isBlock) {
        parent.children.splice(index, 1, element)
        return [SKIP, index]
      }

      let endIndex = -1
      for (let cursor = index + 1; cursor < parent.children.length; cursor++) {
        const candidate = parent.children[cursor]
        if (
          isCommentNode(candidate) &&
          candidate.value.trim().toLowerCase() ===
            `${END_PREFIX}${normalizeComponentName(componentName)}`
        ) {
          endIndex = cursor
          break
        }
      }

      if (endIndex === -1) {
        parent.children.splice(index, 1, element)
        return [SKIP, index]
      }

      element.children = parent.children.slice(index + 1, endIndex)
      parent.children.splice(index, endIndex - index + 1, element)
      return [SKIP, index]
    })
  }
}
