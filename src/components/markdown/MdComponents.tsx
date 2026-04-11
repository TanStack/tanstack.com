import * as React from 'react'
import { FileTabs } from './FileTabs'
import { FrameworkContent } from './FrameworkContent'
import { PackageManagerTabs } from './PackageManagerTabs'
import { CodeBlock } from './CodeBlock.server'
import { Tabs } from './Tabs'
import {
  getInstallCommand,
  PACKAGE_MANAGERS,
  type PackageManager,
} from '~/utils/markdown/installCommand'

function parseJson(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

type MdCommentComponentProps = {
  'data-attributes'?: string
  'data-component'?: string
  'data-files-meta'?: string
  'data-package-manager-meta'?: string
  children?: React.ReactNode
}

function isMdTabPanelElement(
  child: React.ReactNode,
): child is React.ReactElement<MdTabPanelProps> {
  return (
    React.isValidElement(child) &&
    (child.type === MdTabPanel || child.type === 'md-tab-panel')
  )
}

function isMdFrameworkPanelElement(
  child: React.ReactNode,
): child is React.ReactElement<MdFrameworkPanelProps> {
  return (
    React.isValidElement(child) &&
    (child.type === MdFrameworkPanel || child.type === 'md-framework-panel')
  )
}

export function MdCommentComponent({
  'data-attributes': rawAttributes,
  'data-component': componentName,
  'data-files-meta': filesMeta,
  'data-package-manager-meta': packageManagerMeta,
  children,
}: MdCommentComponentProps) {
  const parsedAttributes = parseJson(rawAttributes)
  const attributes =
    parsedAttributes && typeof parsedAttributes === 'object' ? parsedAttributes : {}

  const normalizedComponentName = componentName?.toLowerCase()

  if (normalizedComponentName === 'tabs') {
    const parsedPackageManagerMeta = parseJson(packageManagerMeta)

    if (
      parsedPackageManagerMeta &&
      typeof parsedPackageManagerMeta === 'object' &&
      'packagesByFramework' in parsedPackageManagerMeta &&
      'mode' in parsedPackageManagerMeta &&
      typeof parsedPackageManagerMeta.mode === 'string' &&
      parsedPackageManagerMeta.packagesByFramework &&
      typeof parsedPackageManagerMeta.packagesByFramework === 'object'
    ) {
      const frameworkPanels = Object.entries(
        parsedPackageManagerMeta.packagesByFramework as Record<string, string[][]>,
      ).flatMap(([framework, packageGroups]) => {
        return PACKAGE_MANAGERS.map((packageManager) => {
          const commandText = getInstallCommand(
            packageManager as PackageManager,
            packageGroups,
            parsedPackageManagerMeta.mode,
          ).join('\n')

          return (
            <div
              key={`${framework}-${packageManager}`}
              data-framework={framework}
              data-package-manager={packageManager}
            >
              <CodeBlock>
                <code className="language-bash">{commandText}</code>
              </CodeBlock>
            </div>
          )
        })
      })

      return <PackageManagerTabs>{frameworkPanels}</PackageManagerTabs>
    }

    const childArray = React.Children.toArray(children)
    const panels = childArray.filter(isMdTabPanelElement)

    const parsedFilesMeta = parseJson(filesMeta)

    if (parsedFilesMeta && typeof parsedFilesMeta === 'object' && panels.length) {
      const tabs = Array.isArray((attributes as { tabs?: unknown }).tabs)
        ? ((attributes as { tabs: Array<{ name: string; slug: string }> }).tabs ?? [])
        : []

      return (
        <FileTabs tabs={tabs}>
          {panels.map((panel) => panel.props.children)}
        </FileTabs>
      )
    }

    const tabs = Array.isArray((attributes as { tabs?: unknown }).tabs)
      ? ((attributes as { tabs: Array<{ name: string; slug: string }> }).tabs ?? [])
      : []

    if (!tabs.length) {
      return <div>{children}</div>
    }

    return <Tabs tabs={tabs}>{panels.map((panel) => panel.props.children)}</Tabs>
  }

  if (normalizedComponentName === 'framework') {
    return <MdFrameworkComponentInner>{children}</MdFrameworkComponentInner>
  }

  return <div>{children}</div>
}

type MdTabPanelProps = {
  children?: React.ReactNode
}

export function MdTabPanel({ children }: MdTabPanelProps) {
  return <>{children}</>
}

type MdFrameworkPanelProps = {
  'data-framework'?: string
  children?: React.ReactNode
}

export function MdFrameworkPanel({ children }: MdFrameworkPanelProps) {
  return <>{children}</>
}

function MdFrameworkComponentInner({
  children,
}: {
  children?: React.ReactNode
}) {
  const frameworkPanels: Array<React.ReactNode> = []

  for (const child of React.Children.toArray(children)) {
    if (!isMdFrameworkPanelElement(child)) {
      continue
    }

    const framework = child.props['data-framework']
    if (!framework) {
      continue
    }

    frameworkPanels.push(
      <div key={framework} data-framework={framework}>
        {child.props.children}
      </div>,
    )
  }

  if (!frameworkPanels.length) {
    return <div>{children}</div>
  }

  return <FrameworkContent>{frameworkPanels}</FrameworkContent>
}
