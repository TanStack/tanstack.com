import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import { visit } from 'unist-util-visit'

const COMPONENT_PREFIX = '::'
const START_PREFIX = '::start:'
const END_PREFIX = '::end:'

const componentParser = unified().use(rehypeParse, { fragment: true })

const normalizeComponentName = (name: string) => name.toLowerCase()

function parseDescriptor(descriptor: string) {
  const tree = componentParser.parse(`<${descriptor} />`)
  const node = tree.children[0]
  if (!node || node.type !== 'element') {
    return null
  }

  const component = node.tagName
  const attributes: Record<string, string> = {}
  const properties = node.properties ?? {}
  for (const [key, value] of Object.entries(properties)) {
    if (Array.isArray(value)) {
      attributes[key] = value.join(' ')
    } else if (value != null) {
      attributes[key] = String(value)
    }
  }

  return { component, attributes }
}

const isCommentNode = (value: unknown) =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'comment',
  )

export const rehypeParseCommentComponents = () => {
  return (tree) => {
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
        children: [],
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