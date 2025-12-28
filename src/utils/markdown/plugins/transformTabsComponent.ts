import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { Element } from 'hast'

import { headingLevel, isHeading, slugify } from './helpers'

type TabDescriptor = {
  slug: string
  name: string
  headers: string[]
}

type TabExtraction = {
  tabs: TabDescriptor[]
  panels: Element[][]
}

function extractTabPanels(node: Element): TabExtraction | null {
  const children = node.children ?? []
  const headings = children.filter(isHeading)

  let sectionStarted = false
  let largestHeadingLevel = Infinity
  headings.forEach((heading) => {
    largestHeadingLevel = Math.min(largestHeadingLevel, headingLevel(heading))
  })

  const tabs: TabDescriptor[] = []
  const panels: Element[][] = []
  let currentPanel: Element[] | null = null

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
    const nestedHeadings: string[] = []
    visit({ type: 'root', children: panelChildren }, 'element', (child) => {
      if (isHeading(child) && typeof child.properties?.id === 'string') {
        nestedHeadings.push(String(child.properties.id))
      }
    })
    tabs[index]!.headers = nestedHeadings
  })

  return { tabs, panels }
}

export function transformTabsComponent(node: Element) {
  const result = extractTabPanels(node)
  if (!result) {
    return
  }

  const panelElements: Element[] = result.panels.map((panelChildren, index) => ({
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
