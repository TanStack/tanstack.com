import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import { isElement } from 'hast-util-is-element'

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
    value.type === 'comment'
  )

const slugify = (value: string, fallback: string) => {
  if (!value) {
    return fallback
  }
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || fallback
  )
}

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
      const element: Element = {
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
        return [visit.SKIP, index]
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
        return [visit.SKIP, index]
      }

      const content = parent.children.slice(index + 1, endIndex)
      element.children = content
      parent.children.splice(index, endIndex - index + 1, element)
      return [visit.SKIP, index]
    })
  }
}

const isHeading = (node) =>
  isElement(node) && /^h[1-6]$/.test(node.tagName)

const headingLevel = (node) => Number(node.tagName.substring(1))

function extractTabPanels(node) {
  const children = node.children ?? []
  const headings = children.filter(isHeading)
  if (headings.length === 0) {
    return null
  }

  let sectionStarted = false
  let largestHeadingLevel = Infinity
  headings.forEach((heading) => {
    largestHeadingLevel = Math.min(largestHeadingLevel, headingLevel(heading))
  })

  const tabs: Array<{
    slug: string
    name: string
    headers: Array<string>
  }> = []
  const panels = []

  let currentPanel = null;

  children.forEach((child) => {
    if (isHeading(child)) {
      const level = headingLevel(child)
      if (!sectionStarted) {
        if (level !== largestHeadingLevel) {
          return
        }
        sectionStarted = true
      }

      if (level === largestHeadingLevel) {
        if (currentPanel) {
          panels.push(currentPanel)
        }
        const headingId =
          (child.properties?.id && String(child.properties.id)) ||
          slugify(toString(child), `tab-${tabs.length + 1}`)

        tabs.push({
          slug: headingId,
          name: toString(child),
          headers: [],
        })

        currentPanel = []
        return
      }
    }

    if (sectionStarted) {
      if (!currentPanel) {
        currentPanel = []
      }
      currentPanel.push(child)
    }
  })

  if (currentPanel) {
    panels.push(currentPanel)
  }

  if (!tabs.length) {
    return null
  }

  panels.forEach((panelChildren, index) => {
    const nestedHeadings: Array<string> = []
    visit(
      { type: 'root', children: panelChildren },
      'element',
      (child: Element) => {
        if (isHeading(child) && typeof child.properties?.id === 'string') {
          nestedHeadings.push(String(child.properties.id))
        }
      }
    )
    tabs[index]!.headers = nestedHeadings
  })

  return { tabs, panels }
}

function transformTabsComponent(node: Element) {
  const result = extractTabPanels(node)
  if (!result) {
    return
  }

  const panelElements: Array<Element> = result.panels.map(
    (panelChildren, index) => ({
      type: 'element',
      tagName: 'md-tab-panel',
      properties: {
        'data-tab-slug': result.tabs[index]?.slug ?? `tab-${index + 1}`,
        'data-tab-index': String(index),
      },
      children: panelChildren,
    })
  )

  node.properties = {
    ...node.properties,
    'data-attributes': JSON.stringify({ tabs: result.tabs }),
  }
  node.children = panelElements
}

export const rehypeTransformCommentComponents = () => {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!isElement(node) || node.tagName !== 'md-comment-component') {
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

const CALLOUT_REGEX = /^\[!(?<type>[A-Z]+)]\s*/
const SUPPORTED_CALLOUTS: Record<string, string> = {
  note: 'note',
  tip: 'tip',
  success: 'tip',
  warning: 'warning',
  caution: 'caution',
  danger: 'important',
  important: 'important',
}

export const rehypeCallouts = () => {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return
      }

      if (!isElement(node) || node.tagName !== 'blockquote') {
        return
      }

      const firstChild = node.children?.[0]
      if (!isElement(firstChild) || firstChild.tagName !== 'p') {
        return
      }

      const textNode = firstChild.children?.[0]
      if (!textNode || textNode.type !== 'text') {
        return
      }

      const match = CALLOUT_REGEX.exec(textNode.value ?? '')
      if (!match?.groups?.type) {
        return
      }

      const variantKey = match.groups.type.toLowerCase()
      const variant = SUPPORTED_CALLOUTS[variantKey]
      if (!variant) {
        return
      }

      textNode.value = textNode.value.slice(match[0].length)

      parent.children.splice(index, 1, {
        type: 'element',
        tagName: 'md-comment-component',
        properties: {
          'data-component': 'alert',
          'data-attributes': JSON.stringify({ variant }),
        },
        children: node.children,
      })
    })
  }
}
