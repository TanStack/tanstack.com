'use client'

import { useLocalCurrentFramework } from '../FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import { create } from 'zustand'
import { Tabs, type TabDefinition } from './Tabs'
import { PlainCodeBlock } from './CodeBlock'
import type { Framework } from '~/libraries/types'
import {
  getInstallCommand,
  PACKAGE_MANAGERS,
  type PackageManager,
  type InstallMode,
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
  packagesByFramework: Record<string, string[][]>
  mode: InstallMode
  frameworks: Framework[]
}

export function PackageManagerTabs({
  packagesByFramework,
  mode,
}: PackageManagerTabsProps) {
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
  const packageGroups = packagesByFramework[normalizedFramework]

  // Hide component if current framework not in package list
  if (!packageGroups || packageGroups.length === 0) {
    return null
  }

  // Use stored package manager if valid, otherwise default to first one
  const selectedPackageManager = PACKAGE_MANAGERS.includes(storedPackageManager)
    ? storedPackageManager
    : PACKAGE_MANAGERS[0]

  // Generate tabs for each package manager
  const tabs: TabDefinition[] = PACKAGE_MANAGERS.map((pm) => ({
    slug: pm,
    name: pm,
    headers: [],
  }))

  // Generate children (command blocks) for each package manager
  const children = PACKAGE_MANAGERS.map((pm) => {
    const commands = getInstallCommand(pm, packageGroups, mode)
    const commandText = commands.join('\n')
    return <PlainCodeBlock key={pm} code={commandText} lang="bash" />
  })

  return (
    <div className="package-manager-tabs">
      <Tabs
        tabs={tabs}
        children={children}
        activeSlug={selectedPackageManager}
        onTabChange={(slug) => setPackageManager(slug as PackageManager)}
      />
    </div>
  )
}
