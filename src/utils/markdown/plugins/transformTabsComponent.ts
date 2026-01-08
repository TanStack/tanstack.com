import { toString } from 'hast-util-to-string'

import { headingLevel, isHeading, slugify } from './helpers'

export type VariantHandler = (
  node: HastNode,
  attributes: Record<string, string>,
) => boolean

type InstallMode = 'install' | 'dev-install'

type HastNode = {
  type: string
  tagName: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

type TabDescriptor = {
  slug: string
  name: string
}

type TabExtraction = {
  tabs: TabDescriptor[]
  panels: HastNode[][]
}

type PackageManagerExtraction = {
  packagesByFramework: Record<string, string[]>
  mode: InstallMode
}

type FilesExtraction = {
  files: Array<{
    title: string
    code: string
    language: string
    preNode: HastNode
  }>
}

function parseAttributes(node: HastNode): Record<string, string> {
  const rawAttributes = node.properties?.['data-attributes']
  if (typeof rawAttributes === 'string') {
    try {
      return JSON.parse(rawAttributes)
    } catch {
      return {}
    }
  }
  return {}
}

function resolveMode(attributes: Record<string, string>): InstallMode {
  const mode = attributes.mode?.toLowerCase()
  return mode === 'dev-install' ? 'dev-install' : 'install'
}

function normalizeFrameworkKey(key: string): string {
  return key.trim().toLowerCase()
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
 * Parse a line like "react: @tanstack/react-query @tanstack/react-query-devtools"
 * Returns { framework: 'react', packages: '@tanstack/react-query @tanstack/react-query-devtools' }
 */
function parseFrameworkLine(text: string): {
  framework: string
  packages: string[]
} | null {
  const colonIndex = text.indexOf(':')
  if (colonIndex === -1) {
    return null
  }

  const framework = normalizeFrameworkKey(text.slice(0, colonIndex))
  const packagesStr = text.slice(colonIndex + 1).trim()
  const packages = packagesStr.split(/\s+/).filter(Boolean)

  if (!framework || packages.length === 0) {
    return null
  }

  return { framework, packages }
}

function extractPackageManagerData(
  node: HastNode,
  mode: InstallMode,
): PackageManagerExtraction | null {
  const children = node.children ?? []
  const packagesByFramework: Record<string, string[]> = {}

  const allText = extractText(children)
  const lines = allText.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parsed = parseFrameworkLine(trimmed)
    if (parsed) {
      // Support multiple entries for same framework by concatenating packages
      if (packagesByFramework[parsed.framework]) {
        packagesByFramework[parsed.framework].push(...parsed.packages)
      } else {
        packagesByFramework[parsed.framework] = parsed.packages
      }
    }
  }

  if (Object.keys(packagesByFramework).length === 0) {
    return null
  }

  return { packagesByFramework, mode }
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

  // Extract title from data attribute (set by rehypeCodeMeta)
  let title = ''
  const props = preNode.properties || {}
  // Check both camelCase and kebab-case versions
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
 * Extract files data for variant="files" tabs.
 * Parses consecutive code blocks and creates file tabs.
 */
function extractFilesData(node: HastNode): FilesExtraction | null {
  const children = node.children ?? []
  const files: FilesExtraction['files'] = []

  for (const child of children) {
    // Look for <pre> elements (code blocks)
    if (child.type === 'element' && child.tagName === 'pre') {
      const codeBlockData = extractCodeBlockData(child)
      if (!codeBlockData) continue

      files.push({
        title: codeBlockData.title || 'Untitled',
        code: codeBlockData.code,
        language: codeBlockData.language,
        preNode: child, // Store the original pre node with all its properties
      })
    }
  }

  if (files.length === 0) {
    return null
  }

  return { files }
}

function extractTabPanels(node: HastNode): TabExtraction | null {
  const children = node.children ?? []
  const headings = children.filter(isHeading)

  let sectionStarted = false
  let largestHeadingLevel = Infinity
  headings.forEach((heading: HastNode) => {
    largestHeadingLevel = Math.min(largestHeadingLevel, headingLevel(heading))
  })

  const tabs: TabDescriptor[] = []
  const panels: HastNode[][] = []
  let currentPanel: HastNode[] | null = null

  children.forEach((child: any) => {
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
          typeof child.properties?.id === 'string'
            ? child.properties.id
            : slugify(toString(child as any), `tab-${tabs.length + 1}`)

        tabs.push({
          slug: headingId,
          name: toString(child as any),
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

  return { tabs, panels }
}

export function transformTabsComponent(node: HastNode) {
  const attributes = parseAttributes(node)
  const variant = attributes.variant?.toLowerCase()

  // Handle package-manager variant
  if (variant === 'package-manager') {
    const mode = resolveMode(attributes)
    const result = extractPackageManagerData(node, mode)

    if (!result) {
      return
    }

    // Remove children so package managers don't show up in TOC
    node.children = []

    // Store metadata for the React component
    node.properties = node.properties || {}
    node.properties['data-package-manager-meta'] = JSON.stringify({
      packagesByFramework: result.packagesByFramework,
      mode: result.mode,
    })
    return
  }

  // Handle files variant
  if (variant === 'files') {
    const result = extractFilesData(node)

    if (!result) {
      return
    }

    // Store metadata for the React component (without preNodes to avoid circular refs)
    node.properties = node.properties || {}
    node.properties['data-files-meta'] = JSON.stringify({
      files: result.files.map((f) => ({
        title: f.title,
        code: f.code,
        language: f.language,
      })),
    })

    // Create tab headings from file titles
    const tabs = result.files.map((file, index) => ({
      slug: `file-${index}`,
      name: file.title,
    }))

    node.properties['data-attributes'] = JSON.stringify({ tabs })

    // Create panel elements with original preNodes
    node.children = result.files.map((file, index) => ({
      type: 'element',
      tagName: 'md-tab-panel',
      properties: {
        'data-tab-slug': `file-${index}`,
        'data-tab-index': String(index),
      },
      // Use the original preNode which already has data-code-title from rehypeCodeMeta
      children: [file.preNode],
    }))
    return
  }

  // Handle default tabs variant
  const result = extractTabPanels(node)
  if (!result) {
    return
  }

  const panelElements = result.panels.map((panelChildren, index) => ({
    type: 'element',
    tagName: 'md-tab-panel',
    properties: {
      'data-tab-slug': result.tabs[index]?.slug ?? `tab-${index + 1}`,
      'data-tab-index': String(index),
    },
    children: panelChildren,
  }))

  node.properties = {
    ...node.properties,
    'data-attributes': JSON.stringify({ tabs: result.tabs }),
  }
  node.children = panelElements
}
