import { toString } from 'hast-util-to-string'
import { visit } from 'unist-util-visit'

import { normalizeComponentName } from './helpers'

type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

type FrameworkCodeBlock = {
  title: string
  code: string
  language: string
}

type FrameworkExtraction = {
  codeBlocksByFramework: Record<string, FrameworkCodeBlock[]>
  contentByFramework: Record<string, HastNode[]>
}

/**
 * Extract code block data (language, title, code) from a <pre> element.
 */
function extractCodeBlockData(preNode: HastNode): {
  language: string
  title: string
  code: string
} | null {
  const codeNode = preNode.children?.find(
    (c: HastNode) => c.type === 'element' && c.tagName === 'code',
  )

  if (!codeNode) return null

  // Extract language from className
  let language = 'plaintext'
  const className = codeNode.properties?.className
  if (Array.isArray(className)) {
    const langClass = className.find((c) => String(c).startsWith('language-'))
    if (langClass) {
      language = String(langClass).replace('language-', '')
    }
  }

  // Extract title from data attributes
  let title = ''
  const props = preNode.properties || {}
  if (typeof props['dataCodeTitle'] === 'string') {
    title = props['dataCodeTitle'] as string
  } else if (typeof props['data-code-title'] === 'string') {
    title = props['data-code-title']
  } else if (typeof props['dataFilename'] === 'string') {
    title = props['dataFilename'] as string
  } else if (typeof props['data-filename'] === 'string') {
    title = props['data-filename']
  }

  // Extract code text
  const extractText = (nodes: HastNode[]): string => {
    let text = ''
    for (const node of nodes) {
      if (node.type === 'text' && node.value) {
        text += node.value
      } else if (node.type === 'element' && node.children) {
        text += extractText(node.children)
      }
    }
    return text
  }
  const code = extractText(codeNode.children || [])

  return { language, title, code }
}

function extractFrameworkData(node: HastNode): FrameworkExtraction | null {
  const children = node.children ?? []
  const codeBlocksByFramework: Record<string, FrameworkCodeBlock[]> = {}
  const contentByFramework: Record<string, HastNode[]> = {}

  // First pass: find the first H1 to determine the first framework
  let firstFramework: string | null = null
  for (const child of children) {
    if (child.type === 'element' && child.tagName === 'h1') {
      firstFramework = toString(child as any)
        .trim()
        .toLowerCase()
      break
    }
  }

  // If no H1 found at all, return null
  if (!firstFramework) {
    return null
  }

  // Second pass: collect content
  let currentFramework: string | null = firstFramework // Start with first framework for content before first H1

  // Initialize the first framework
  contentByFramework[firstFramework] = []
  codeBlocksByFramework[firstFramework] = []

  for (const child of children) {
    // Check if this is an H1 heading (framework divider)
    if (child.type === 'element' && child.tagName === 'h1') {
      // Extract framework name from H1 text
      currentFramework = toString(child as any)
        .trim()
        .toLowerCase()

      // Initialize arrays for this framework
      if (currentFramework && !contentByFramework[currentFramework]) {
        contentByFramework[currentFramework] = []
        codeBlocksByFramework[currentFramework] = []
      }
      // Don't include the H1 itself in content - it's just a divider
      continue
    }

    if (!currentFramework) continue

    // Create a shallow copy of the node
    const contentNode = Object.assign({}, child) as HastNode

    // Mark all headings (h2-h6) with framework attribute so they appear in TOC only for this framework
    if (
      contentNode.type === 'element' &&
      contentNode.tagName &&
      /^h[2-6]$/.test(contentNode.tagName)
    ) {
      contentNode.properties = (contentNode.properties || {}) as Record<
        string,
        unknown
      >
      contentNode.properties['data-framework'] = currentFramework
    }

    contentByFramework[currentFramework].push(contentNode)

    // Extract code blocks for this framework
    if (contentNode.type === 'element' && contentNode.tagName === 'pre') {
      const codeBlockData = extractCodeBlockData(contentNode)
      if (codeBlockData) {
        codeBlocksByFramework[currentFramework].push(codeBlockData)
      }
    }
  }

  // Return null if no frameworks found
  if (Object.keys(contentByFramework).length === 0) {
    return null
  }

  return { codeBlocksByFramework, contentByFramework }
}

export function transformFrameworkComponent(node: HastNode) {
  const result = extractFrameworkData(node)

  if (!result) {
    return
  }

  node.properties = node.properties || {}
  node.properties['data-framework-meta'] = JSON.stringify({
    codeBlocksByFramework: Object.fromEntries(
      Object.entries(result.codeBlocksByFramework).map(([fw, blocks]) => [
        fw,
        blocks.map((b) => ({
          title: b.title,
          code: b.code,
          language: b.language,
        })),
      ]),
    ),
  })

  // Store available frameworks for the component
  const availableFrameworks = Object.keys(result.contentByFramework)
  node.properties['data-available-frameworks'] =
    JSON.stringify(availableFrameworks)

  node.children = availableFrameworks.map((fw) => {
    const content = result.contentByFramework[fw] || []
    return {
      type: 'element',
      tagName: 'md-framework-panel',
      properties: {
        'data-framework': fw,
      },
      children: content,
    }
  })
}

/**
 * Rehype plugin to transform framework components in the AST.
 * Visits the tree and calls transformFrameworkComponent for each framework component found.
 */
export const rehypeTransformFrameworkComponents = () => {
  return (tree: any) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'md-comment-component') {
        return
      }

      const component = String(node.properties?.['data-component'] ?? '')
      if (normalizeComponentName(component) === 'framework') {
        transformFrameworkComponent(node)
      }
    })
  }
}
