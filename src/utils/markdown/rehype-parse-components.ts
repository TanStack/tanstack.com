// Modified from: https://github.com/playfulprogramming/playfulprogramming/blob/main/src/utils/markdown/components/rehype-parse-components.ts

import { is } from 'unist-util-is'
import * as hast from 'hast'
import { unified, Plugin } from 'unified'
import rehypeParse from 'rehype-parse'
import { VFile } from 'vfile'
import { ComponentMarkupNode, PlayfulNode, PlayfulRoot } from './components'

const unifiedRehype = unified().use(rehypeParse, { fragment: true })

const COMPONENT_PREFIX = '::'
const START_PREFIX = '::start:'
const END_PREFIX = '::end:'

const isNodeComment = (node: unknown): node is hast.Comment =>
  !!(
    typeof node === 'object' &&
    node &&
    'type' in node &&
    node.type === 'comment'
  )

const isNodeElement = (node: unknown): node is hast.Element =>
  (typeof node === 'object' &&
    node &&
    'type' in node &&
    node['type'] === 'element') ??
  false

export const rehypeParseComponents: Plugin<[], PlayfulRoot> = function () {
  function parseComponents(
    tree: PlayfulRoot,
    vfile: VFile
  ): (PlayfulNode | hast.ElementContent)[] {
    for (let index = 0; index < tree.children.length; index++) {
      const node = tree.children[index]

      if (!isNodeComment(node)) continue

      // ` ::start:in-content-ad title="Hello world" `
      const value = String(node.value).trim()
      if (!value.startsWith(COMPONENT_PREFIX)) continue

      const isRanged = value.startsWith(START_PREFIX)
      // `in-content-ad title="Hello world"`
      const valueContent = isRanged
        ? value.substring(START_PREFIX.length)
        : value.substring(COMPONENT_PREFIX.length)

      // Parse the attributes/tagNode from the start tag
      const componentNode = unifiedRehype.parse(`<${valueContent}/>`)
        .children[0]
      if (!isNodeElement(componentNode)) {
        continue
      }

      // If the component is ranged, find the index of its end tag
      let indexEnd = 0
      if (isRanged) {
        for (let i = index + 1; i < tree.children.length; i++) {
          const nodeEnd = tree.children[i]
          if (
            is(nodeEnd, {
              type: 'comment',
              value: ` ${END_PREFIX}${componentNode.tagName} `,
            })
          ) {
            indexEnd = i
            break
          }
        }
      }

      // Fetch all nodes between the ranged comments (if indexEnd=0, this will be an empty array)
      const componentChildren = tree.children.slice(index + 1, indexEnd)
      const parsedComponentChildren = parseComponents(
        { type: 'root', children: componentChildren },
        vfile
      )

      const replacement: ComponentMarkupNode = {
        type: 'playful-component-markup',
        position: node.position,
        component: componentNode.tagName,
        attributes: Object.fromEntries(
          Object.entries(componentNode.properties).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(' ') : String(value),
          ])
        ),
        children: parsedComponentChildren,
      }

      tree.children.splice(
        index,
        isRanged ? indexEnd - index + 1 : 1,
        replacement
      )
    }

    return tree.children
  }

  return async (tree, vfile) => {
    parseComponents(tree, vfile)
  }
}
