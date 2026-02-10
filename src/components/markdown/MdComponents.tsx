'use client'

import * as React from 'react'
import type { Framework } from '~/libraries/types'
import { Tabs } from './Tabs'
import { PackageManagerTabs } from './PackageManagerTabs'
import { FileTabs } from './FileTabs'
import { FrameworkContent } from './FrameworkContent'

type MdCommentComponentProps = {
  'data-component'?: string
  'data-attributes'?: string
  'data-package-manager-meta'?: string
  'data-files-meta'?: string
  children?: React.ReactNode
}

/**
 * Handles md-comment-component elements from rehype-react.
 * Maps to the appropriate tab/framework component based on data attributes.
 */
export function MdCommentComponent({
  'data-component': componentName,
  'data-attributes': rawAttributes,
  'data-package-manager-meta': pmMeta,
  'data-files-meta': filesMeta,
  children,
}: MdCommentComponentProps) {
  const attributes: Record<string, any> = React.useMemo(() => {
    if (typeof rawAttributes === 'string') {
      try {
        return JSON.parse(rawAttributes)
      } catch {
        return {}
      }
    }
    return {}
  }, [rawAttributes])

  const normalizedComponent = componentName?.toLowerCase()

  // Handle tabs component
  if (normalizedComponent === 'tabs') {
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

    // Handle files variant
    if (filesMeta) {
      try {
        const tabs = attributes.tabs || []
        // Children are already React nodes from rehype-react
        const childArray = React.Children.toArray(children)
        const panelChildren = childArray.filter(
          (child): child is React.ReactElement<MdTabPanelProps> =>
            React.isValidElement(child) &&
            (child.type === MdTabPanel || child.type === 'md-tab-panel'),
        )

        const tabContents = panelChildren.map((panel) => panel.props.children)

        return <FileTabs tabs={tabs} children={tabContents} />
      } catch {
        // Fall through to default tabs if parsing fails
      }
    }

    // Handle default tabs variant
    const tabs = attributes.tabs
    if (!tabs || !Array.isArray(tabs)) {
      return <div>{children}</div>
    }

    // Children are already React nodes from rehype-react
    const childArray = React.Children.toArray(children)
    const panelChildren = childArray.filter(
      (child): child is React.ReactElement<MdTabPanelProps> =>
        React.isValidElement(child) &&
        (child.type === MdTabPanel || child.type === 'md-tab-panel'),
    )

    const tabContents = panelChildren.map((panel) => (
      <>{panel.props.children}</>
    ))

    return <Tabs tabs={tabs} children={tabContents} />
  }

  // Handle framework component
  if (normalizedComponent === 'framework') {
    return <MdFrameworkComponentInner children={children} />
  }

  // Default: just render children in a div
  return <div>{children}</div>
}

type MdTabPanelProps = {
  'data-tab-slug'?: string
  'data-tab-index'?: string
  children?: React.ReactNode
}

/**
 * Wrapper for md-tab-panel elements.
 * These are intermediate elements that hold tab content.
 */
export function MdTabPanel({ children }: MdTabPanelProps) {
  // This component is mainly used as a marker for MdCommentComponent to find
  return <>{children}</>
}

type MdFrameworkPanelProps = {
  'data-framework'?: string
  children?: React.ReactNode
}

/**
 * Wrapper for md-framework-panel elements.
 * These hold framework-specific content.
 */
export function MdFrameworkPanel({ children }: MdFrameworkPanelProps) {
  // This component is mainly used as a marker
  return <>{children}</>
}

type MdFrameworkComponentInnerProps = {
  children?: React.ReactNode
}

/**
 * Inner component for framework switching.
 * Extracts framework panels from children and renders FrameworkContent.
 */
function MdFrameworkComponentInner({
  children,
}: MdFrameworkComponentInnerProps) {
  const childArray = React.Children.toArray(children)

  // Find all framework panel children
  const panelChildren = childArray.filter(
    (child): child is React.ReactElement<MdFrameworkPanelProps> =>
      React.isValidElement(child) &&
      (child.type === MdFrameworkPanel || child.type === 'md-framework-panel'),
  )

  // Build panelsByFramework map
  const panelsByFramework: Record<string, React.ReactNode> = {}
  const availableFrameworks: string[] = []

  panelChildren.forEach((panel) => {
    const fw = panel.props['data-framework']
    if (fw) {
      panelsByFramework[fw] = panel.props.children
      availableFrameworks.push(fw)
    }
  })

  if (availableFrameworks.length === 0) {
    return <div>{children}</div>
  }

  return (
    <FrameworkContent
      codeBlocksByFramework={{}}
      availableFrameworks={availableFrameworks}
      panelsByFramework={panelsByFramework}
    />
  )
}
