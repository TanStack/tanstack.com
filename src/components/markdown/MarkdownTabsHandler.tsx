import * as React from 'react'
import { domToReact, Element } from 'html-react-parser'
import type { HTMLReactParserOptions } from 'html-react-parser'
import type { Framework } from '~/libraries/types'
import { Tabs } from './Tabs'
import { PackageManagerTabs } from './PackageManagerTabs'
import { FileTabs } from './FileTabs'

export function handleTabsComponent(
  domNode: Element,
  attributes: Record<string, any>,
  options: HTMLReactParserOptions,
) {
  const pmMeta = domNode.attribs['data-package-manager-meta']

  // Handle package-manager variant
  if (pmMeta) {
    try {
      const { packagesByFramework, mode } = JSON.parse(pmMeta)
      const frameworks = Object.keys(packagesByFramework) as Framework[]

      return (
        <PackageManagerTabs
          packagesByFramework={packagesByFramework}
          mode={mode}
          frameworks={frameworks}
        />
      )
    } catch {
      // Fall through to default tabs if parsing fails
    }
  }

  // Check if this is files variant
  const filesMeta = domNode.attribs['data-files-meta']
  if (filesMeta) {
    try {
      const tabs = attributes.tabs || []

      const panelElements = domNode.children?.filter(
        (child): child is Element =>
          child instanceof Element && child.name === 'md-tab-panel',
      )

      const children = panelElements?.map((panel) =>
        domToReact(panel.children as any, options),
      )

      return <FileTabs tabs={tabs} children={children as any} />
    } catch {
      // Fall through to default tabs if parsing fails
    }
  }

  // Handle default tabs variant
  const tabs = attributes.tabs

  if (!tabs || !Array.isArray(tabs)) {
    return null
  }

  const panelElements = domNode.children?.filter(
    (child): child is Element =>
      child instanceof Element && child.name === 'md-tab-panel',
  )

  const children = panelElements?.map((panel) => {
    const result = domToReact(panel.children as any, options)
    // Wrap in fragment to ensure it's a single React node
    return <>{result}</>
  })

  return <Tabs tabs={tabs} children={children as any} />
}
