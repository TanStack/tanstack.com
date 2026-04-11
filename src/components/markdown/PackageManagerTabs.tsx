'use client'

import { useLocalCurrentFramework } from '../FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import * as React from 'react'
import { create } from 'zustand'
import { Tabs, type TabDefinition } from './Tabs'
import type { Framework } from '~/libraries/types'
import {
  PACKAGE_MANAGERS,
  type PackageManager,
} from '~/utils/markdown/installCommand'

// Use zustand for cross-component synchronization
// This ensures all PackageManagerTabs instances on the page stay in sync
const usePackageManagerStore = create<{
  packageManager: PackageManager
  setPackageManager: (pm: PackageManager) => void
}>((set) => ({
  packageManager:
    typeof document !== 'undefined'
      ? (localStorage.getItem('packageManager') as PackageManager) || 'npm'
      : 'npm',
  setPackageManager: (pm: PackageManager) => {
    localStorage.setItem('packageManager', pm)
    set({ packageManager: pm })
  },
}))

type PackageManagerTabsProps = {
  children?: React.ReactNode
}

function isPackageManagerPanel(
  child: React.ReactNode,
): child is React.ReactElement<{
  'data-framework': string
  'data-package-manager': string
  children?: React.ReactNode
}> {
  return (
    React.isValidElement<{
      'data-framework'?: string
      'data-package-manager'?: string
    }>(child) &&
    typeof child.props['data-framework'] === 'string' &&
    typeof child.props['data-package-manager'] === 'string'
  )
}

export function PackageManagerTabs({ children }: PackageManagerTabsProps) {
  const { packageManager: storedPackageManager, setPackageManager } =
    usePackageManagerStore()

  const { framework: paramsFramework } = useParams({ strict: false })
  const localCurrentFramework = useLocalCurrentFramework()
  const userQuery = useCurrentUserQuery()
  const userFramework = userQuery.data?.lastUsedFramework

  const actualFramework = (paramsFramework ||
    userFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  const normalizedFramework = actualFramework.toLowerCase()
  const panels = React.Children.toArray(children).filter(isPackageManagerPanel)
  const availableFramework = panels.find((child) => {
    return child.props['data-framework'] === normalizedFramework
  })
    ? normalizedFramework
    : panels[0]?.props['data-framework']
  const packageManagerPanels = panels.filter((child) => {
    return child.props['data-framework'] === availableFramework
  })

  if (!packageManagerPanels.length) {
    return null
  }

  // Use stored package manager if valid, otherwise default to first one
  const selectedPackageManager = PACKAGE_MANAGERS.includes(storedPackageManager)
    ? storedPackageManager
    : PACKAGE_MANAGERS[0]

  const tabs: Array<TabDefinition> = packageManagerPanels.map((panel) => {
    const packageManager = panel.props['data-package-manager'] as PackageManager

    return {
      slug: packageManager,
      name: packageManager,
      headers: [],
    }
  })

  return (
    <div className="package-manager-tabs">
      <Tabs
        tabs={tabs}
        activeSlug={selectedPackageManager}
        onTabChange={(slug) => setPackageManager(slug as PackageManager)}
      >
        {packageManagerPanels.map((panel) => panel.props.children)}
      </Tabs>
    </div>
  )
}
