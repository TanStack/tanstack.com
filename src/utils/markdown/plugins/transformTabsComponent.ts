import { toString } from 'hast-util-to-string'

import { headingLevel, isHeading, slugify } from './helpers'

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

  // Recursively extract text from all children (including nested in <p> tags)
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

function createPackageManagerHeadings(): HastNode[] {
  const packageManagers = ['npm', 'pnpm', 'yarn', 'bun']
  const nodes: HastNode[] = []

  for (const pm of packageManagers) {
    // Create heading for package manager
    const heading: any = {
      type: 'element',
      tagName: 'h1',
      properties: { id: pm },
      children: [{ type: 'text', value: pm }],
    }

    nodes.push(heading)
  }

  return nodes
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

    // Replace children with package manager headings
    node.children = createPackageManagerHeadings()

    // Store metadata for the React component
    node.properties = node.properties || {}
    node.properties['data-package-manager-meta'] = JSON.stringify({
      packagesByFramework: result.packagesByFramework,
      mode: result.mode,
    })
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
