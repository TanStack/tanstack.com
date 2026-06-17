import { toString } from 'hast-util-to-string'
import type { Element, ElementContent } from 'hast'

import { headingLevel, isHeading, slugify } from './helpers'
import { BUNDLERS, isBundler, type Bundler } from '../bundler'

export type VariantHandler = (
  node: HastNode,
  attributes: Record<string, string>,
) => boolean

type InstallMode = 'install' | 'dev-install' | 'local-install'

type HastNode = Element

type TabDescriptor = {
  slug: string
  name: string
}

type TabExtraction = {
  tabs: TabDescriptor[]
  panels: ElementContent[][]
}

type PackageManagerExtraction = {
  packagesByFramework: Record<string, string[][]>
  mode: InstallMode
}

type FilesExtraction = {
  files: Array<{
    title: string
    code: string
    language: string
    preNode: Element
  }>
}

function parseAttributes(node: HastNode): Record<string, string> {
  const rawAttributes = node.properties?.['data-attributes']
  if (typeof rawAttributes === 'string') {
    try {
      return JSON.parse(rawAttributes)
    } catch (error) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          '[transformTabsComponent] Failed to parse data-attributes JSON:',
          rawAttributes,
          error,
        )
      }
      return {}
    }
  }
  return {}
}

function resolveMode(attributes: Record<string, string>): InstallMode {
  const mode = attributes.mode?.toLowerCase()
  if (mode === 'dev-install') return 'dev-install'
  if (mode === 'local-install') return 'local-install'
  return 'install'
}

function normalizeFrameworkKey(key: string): string {
  return key.trim().toLowerCase()
}

// Helper to extract text from nodes (used for code content)
function extractText(nodes: ReadonlyArray<ElementContent>): string {
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
  const packagesByFramework: Record<string, string[][]> = {}

  const allText = extractText(children)
  const lines = allText.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parsed = parseFrameworkLine(trimmed)
    if (parsed) {
      // Each line becomes a separate entry (array of packages)
      // Multiple packages on same line = install together
      // Multiple lines = install separately
      if (packagesByFramework[parsed.framework]) {
        packagesByFramework[parsed.framework].push(parsed.packages)
      } else {
        packagesByFramework[parsed.framework] = [parsed.packages]
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
  const codeNode = preNode.children?.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'code',
  )

  if (!codeNode) return null

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
    title = props['dataCodeTitle']
  } else if (typeof props['data-code-title'] === 'string') {
    title = props['data-code-title']
  } else if (typeof props['dataFilename'] === 'string') {
    title = props['dataFilename']
  } else if (typeof props['data-filename'] === 'string') {
    title = props['data-filename']
  }

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
    if (child.type === 'element' && child.tagName === 'pre') {
      const codeBlockData = extractCodeBlockData(child)
      if (!codeBlockData) continue

      files.push({
        title: codeBlockData.title || 'Untitled',
        code: codeBlockData.code,
        language: codeBlockData.language,
        preNode: child,
      })
    }
  }

  if (files.length === 0) {
    return null
  }

  return { files }
}

/**
 * Extract bundler tab data. Splits children by headings whose text matches a
 * known bundler (e.g. `# Vite`, `## Rsbuild`). Uses the largest heading level
 * present, mirroring `extractTabPanels`. Unknown headings are ignored; content
 * before any recognized heading is dropped.
 */
function extractBundlerData(node: HastNode): TabExtraction | null {
  const children = node.children ?? []
  const headings = children.filter(isHeading)

  if (headings.length === 0) {
    return null
  }

  let largestHeadingLevel = Infinity
  for (const heading of headings) {
    largestHeadingLevel = Math.min(largestHeadingLevel, headingLevel(heading))
  }

  const panelsByBundler = new Map<Bundler, ElementContent[]>()
  let currentBundler: Bundler | null = null

  for (const child of children) {
    if (isHeading(child) && headingLevel(child) === largestHeadingLevel) {
      const headingText = toString(child).trim().toLowerCase()
      if (isBundler(headingText)) {
        currentBundler = headingText
        if (!panelsByBundler.has(currentBundler)) {
          panelsByBundler.set(currentBundler, [])
        }
        continue
      }
      currentBundler = null
      continue
    }

    if (currentBundler) {
      panelsByBundler.get(currentBundler)!.push(child)
    }
  }

  if (panelsByBundler.size === 0) {
    return null
  }

  const tabs: TabDescriptor[] = []
  const panels: ElementContent[][] = []
  for (const bundler of BUNDLERS) {
    const panel = panelsByBundler.get(bundler)
    if (!panel) continue
    tabs.push({ slug: bundler, name: bundler })
    panels.push(panel)
  }

  return { tabs, panels }
}

function extractTabPanels(node: HastNode): TabExtraction | null {
  const children = node.children ?? []
  const headings = children.filter(isHeading)

  let sectionStarted = false
  let largestHeadingLevel = Infinity
  headings.forEach((heading) => {
    largestHeadingLevel = Math.min(largestHeadingLevel, headingLevel(heading))
  })

  const tabs: TabDescriptor[] = []
  const panels: ElementContent[][] = []
  let currentPanel: ElementContent[] | null = null

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
          typeof child.properties?.id === 'string'
            ? child.properties.id
            : slugify(toString(child), `tab-${tabs.length + 1}`)

        tabs.push({
          slug: headingId,
          name: toString(child),
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
  if (variant === 'package-manager' || variant === 'package-managers') {
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
    node.children = result.files.map(
      (file, index): Element => ({
        type: 'element',
        tagName: 'md-tab-panel',
        properties: {
          'data-tab-slug': `file-${index}`,
          'data-tab-index': String(index),
        },
        // Use the original preNode which already has data-code-title from rehypeCodeMeta
        children: [file.preNode],
      }),
    )
    return
  }

  // Handle bundler variant
  if (variant === 'bundler') {
    const result = extractBundlerData(node)

    if (!result) {
      return
    }

    node.properties = node.properties || {}
    node.properties['data-bundler-meta'] = JSON.stringify({
      bundlers: result.tabs.map((t) => t.slug),
    })
    node.properties['data-attributes'] = JSON.stringify({ tabs: result.tabs })

    node.children = result.panels.map((panelChildren, index): Element => {
      const isCodeOnly =
        panelChildren.length === 1 &&
        panelChildren[0]?.type === 'element' &&
        panelChildren[0]?.tagName === 'pre'

      return {
        type: 'element',
        tagName: 'md-tab-panel',
        properties: {
          'data-tab-slug': result.tabs[index]?.slug ?? `bundler-${index + 1}`,
          'data-tab-index': String(index),
          'data-content': isCodeOnly ? 'code-only' : 'mixed',
        },
        children: panelChildren,
      }
    })
    return
  }

  // Handle default tabs variant
  const result = extractTabPanels(node)
  if (!result) {
    return
  }

  const panelElements = result.panels.map(
    (panelChildren, index): Element => ({
      type: 'element',
      tagName: 'md-tab-panel',
      properties: {
        'data-tab-slug': result.tabs[index]?.slug ?? `tab-${index + 1}`,
        'data-tab-index': String(index),
      },
      children: panelChildren,
    }),
  )

  node.properties = {
    ...node.properties,
    'data-attributes': JSON.stringify({ tabs: result.tabs }),
  }
  node.children = panelElements
}
