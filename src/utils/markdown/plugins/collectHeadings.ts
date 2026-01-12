import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'

import { isHeading } from './helpers'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
  framework?: string
}

type HastElement = {
  type: string
  tagName: string
  properties?: Record<string, unknown>
  children?: unknown[]
}

type HastRoot = {
  type: 'root'
  children: unknown[]
}

type VFileData = {
  data: Record<string, unknown>
}

const isTabsAncestor = (ancestor: HastElement) => {
  if (ancestor.type !== 'element') {
    return false
  }

  if (ancestor.tagName !== 'md-comment-component') {
    return false
  }

  const component = ancestor.properties?.['data-component']
  return typeof component === 'string' && component.toLowerCase() === 'tabs'
}

const isFrameworkPanelAncestor = (ancestor: HastElement) => {
  if (ancestor.type !== 'element') {
    return false
  }

  return ancestor.tagName === 'md-framework-panel'
}

export function rehypeCollectHeadings(initialHeadings?: MarkdownHeading[]) {
  const headings = initialHeadings ?? []

  return function collectHeadings(tree: HastRoot, file?: VFileData) {
    visit(tree as any, 'element', (node: HastElement, _index, ancestors) => {
      if (!isHeading(node)) {
        return
      }

      if (Array.isArray(ancestors)) {
        const insideTabs = ancestors.some((ancestor) =>
          isTabsAncestor(ancestor as HastElement),
        )
        if (insideTabs) {
          return
        }
      }

      const id =
        typeof node.properties?.id === 'string' ? node.properties.id : ''
      if (!id) {
        return
      }

      let currentFramework: string | undefined

      const headingDataFramework = node.properties?.['data-framework']
      if (typeof headingDataFramework === 'string') {
        currentFramework = headingDataFramework
      } else if (Array.isArray(ancestors)) {
        const frameworkPanel = ancestors.find((ancestor) =>
          isFrameworkPanelAncestor(ancestor as HastElement),
        ) as HastElement | undefined

        if (frameworkPanel) {
          const dataFramework = frameworkPanel.properties?.['data-framework']
          if (typeof dataFramework === 'string') {
            currentFramework = dataFramework
          }
        }
      }

      headings.push({
        id,
        level: Number(node.tagName.substring(1)),
        text: toString(node as any).trim(),
        framework: currentFramework,
      })
    })

    if (file) {
      file.data.headings = headings
    }
  }
}
