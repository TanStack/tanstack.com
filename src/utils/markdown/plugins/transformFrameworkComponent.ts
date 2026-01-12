import { toString } from 'hast-util-to-string'
import { visit } from 'unist-util-visit'

import { isHeading, normalizeComponentName } from './helpers'

type HastNode = {
  type: string
  tagName: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

type FrameworkCodeBlock = {
  title: string
  code: string
  language: string
  preNode: HastNode
}

type FrameworkExtraction = {
  codeBlocksByFramework: Record<string, FrameworkCodeBlock[]>
  contentByFramework: Record<string, HastNode[]>
}

// Helper to extract text from nodes (used for code content)
function extractText(nodes: any[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      text += node.value
    } else if (node.type === 'element' && node.children) {
      text += extractText(node.children)
    }
  }
  return text
}

/**
 * Extract code block data (language, title, code) from a <pre> element.
 * Extracts title from data-code-title (set by rehypeCodeMeta).
 */
function extractCodeBlockData(preNode: HastNode): {
  language: string
  title: string
  code: string
} | null {
  // Find the <code> child
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

  // Extract code content
  const code = extractText(codeNode.children || [])

  return { language, title, code }
}

/**
 * Extract framework-specific content for framework component.
 * Groups all content (code blocks and general content) by framework headings.
 */
function extractFrameworkData(node: HastNode): FrameworkExtraction | null {
  const children = node.children ?? []
  const codeBlocksByFramework: Record<string, FrameworkCodeBlock[]> = {}
  const contentByFramework: Record<string, HastNode[]> = {}

  let currentFramework: string | null = null

  for (const child of children) {
    if (isHeading(child)) {
      currentFramework = toString(child as any)
        .trim()
        .toLowerCase()
      // Initialize arrays for this framework
      if (currentFramework && !contentByFramework[currentFramework]) {
        contentByFramework[currentFramework] = []
        codeBlocksByFramework[currentFramework] = []
      }
      continue
    }

    // Skip if no framework heading found yet
    if (!currentFramework) continue

    // Add all content to contentByFramework
    contentByFramework[currentFramework].push(child)

    // Look for <pre> elements (code blocks) under current framework
    if ((child as any).type === 'element' && (child as any).tagName === 'pre') {
      const codeBlockData = extractCodeBlockData(child)
      if (!codeBlockData) continue

      codeBlocksByFramework[currentFramework].push({
        title: codeBlockData.title || 'Untitled',
        code: codeBlockData.code,
        language: codeBlockData.language,
        preNode: child,
      })
    }
  }

  // Return null only if no frameworks found at all
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
