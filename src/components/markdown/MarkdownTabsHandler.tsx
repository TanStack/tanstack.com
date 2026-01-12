import * as React from 'react'
import { domToReact, Element } from 'html-react-parser'
import type { HTMLReactParserOptions } from 'html-react-parser'
import type { Framework } from '~/libraries/types'

// Helper to resolve different module shapes (named export vs default)
function resolveModuleDefault(mod: any, key: string): React.ComponentType<any> {
  if (!mod) return undefined as any
  if (mod[key] && typeof mod[key] === 'function') return mod[key]
  if (mod.default) {
    if (mod.default[key] && typeof mod.default[key] === 'function')
      return mod.default[key]
    if (typeof mod.default === 'function') return mod.default
  }
  if (typeof mod === 'function') return mod
  return (mod as any).default ?? (mod as any)
}

const Tabs = React.lazy<React.ComponentType<any>>(() =>
  import('./Tabs').then((mod) => ({
    default: resolveModuleDefault(mod, 'Tabs'),
  })),
)
const PackageManagerTabs = React.lazy<React.ComponentType<any>>(() =>
  import('./PackageManagerTabs').then((mod) => ({
    default: resolveModuleDefault(mod, 'PackageManagerTabs'),
  })),
)
const FileTabs = React.lazy<React.ComponentType<any>>(() =>
  import('./FileTabs').then((mod) => ({
    default: resolveModuleDefault(mod, 'FileTabs'),
  })),
)

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
      const id =
        attributes.id ||
        `package-manager-tabs-${Math.random().toString(36).slice(2, 9)}`
      const frameworks = Object.keys(packagesByFramework) as Framework[]

      return (
        <React.Suspense fallback={<div>Loading...</div>}>
          <PackageManagerTabs
            id={id}
            packagesByFramework={packagesByFramework}
            mode={mode}
            frameworks={frameworks}
          />
        </React.Suspense>
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
      const id =
        attributes.id || `files-tabs-${Math.random().toString(36).slice(2, 9)}`

      const panelElements = domNode.children?.filter(
        (child): child is Element =>
          child instanceof Element && child.name === 'md-tab-panel',
      )

      const children = panelElements?.map((panel) =>
        domToReact(panel.children as any, options),
      )

      return (
        <React.Suspense fallback={<div>Loading...</div>}>
          <FileTabs id={id} tabs={tabs} children={children as any} />
        </React.Suspense>
      )
    } catch {
      // Fall through to default tabs if parsing fails
    }
  }

  // Handle default tabs variant
  const tabs = attributes.tabs
  const id = attributes.id || `tabs-${Math.random().toString(36).slice(2, 9)}`

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

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Tabs id={id} tabs={tabs} children={children as any} />
    </React.Suspense>
  )
}
