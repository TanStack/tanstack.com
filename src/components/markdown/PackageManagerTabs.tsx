import { useLocalCurrentFramework } from '../FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import * as React from 'react'
import { create } from 'zustand'
import { Tabs, type TabDefinition } from './Tabs'
import { CodeBlock } from './CodeBlock'
import type { Framework } from '~/libraries/types'
import {
  getInstallCommand,
  PACKAGE_MANAGERS,
  type PackageManager,
  type InstallMode,
} from '~/utils/markdown/installCommand'

const DEFAULT_PACKAGE_MANAGER: PackageManager = 'npm'

function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as string[]).includes(value)
}

const usePackageManagerStore = create<{
  packageManager: PackageManager
  setPackageManager: (pm: PackageManager) => void
}>((set) => ({
  packageManager: DEFAULT_PACKAGE_MANAGER,
  setPackageManager: (pm) => {
    if (typeof document !== 'undefined') {
      localStorage.setItem('packageManager', pm)
    }
    set({ packageManager: pm })
  },
}))

let hasHydratedPackageManagerStore = false

function useHydratePackageManagerStore() {
  React.useEffect(() => {
    if (hasHydratedPackageManagerStore) return
    hasHydratedPackageManagerStore = true
    const stored = localStorage.getItem('packageManager')
    if (stored && isPackageManager(stored)) {
      usePackageManagerStore.setState({ packageManager: stored })
    }
  }, [])
}

// Built once; PACKAGE_MANAGERS is constant.
const tabDefinitions: TabDefinition[] = PACKAGE_MANAGERS.map((pm) => ({
  slug: pm,
  name: pm,
  headers: [],
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
  useHydratePackageManagerStore()

  const selectedPackageManager = usePackageManagerStore((s) => s.packageManager)
  const setPackageManager = usePackageManagerStore((s) => s.setPackageManager)

  const { framework: paramsFramework } = useParams({ strict: false })
  const localCurrentFramework = useLocalCurrentFramework()
  const userQuery = useCurrentUserQuery()
  const userFramework = userQuery.data?.lastUsedFramework

  const actualFramework =
    paramsFramework ||
    userFramework ||
    localCurrentFramework.currentFramework ||
    'react'

  const normalizedFramework = actualFramework.toLowerCase()
  const packageGroups = packagesByFramework[normalizedFramework]

  const children = React.useMemo(() => {
    if (!packageGroups || packageGroups.length === 0) return null
    return PACKAGE_MANAGERS.map((pm) => {
      const commands = getInstallCommand(pm, packageGroups, mode)
      const commandText = commands.join('\n')
      return (
        <CodeBlock key={pm}>
          <code className="language-bash">{commandText}</code>
        </CodeBlock>
      )
    })
  }, [packageGroups, mode])

  const handleTabChange = React.useCallback(
    (slug: string) => {
      if (isPackageManager(slug)) {
        setPackageManager(slug)
      }
    },
    [setPackageManager],
  )

  if (!children) {
    return null
  }

  return (
    <Tabs
      tabs={tabDefinitions}
      /* eslint-disable-next-line react/no-children-prop */
      children={children}
      activeSlug={selectedPackageManager}
      onTabChange={handleTabChange}
      panelContent="code-only"
    />
  )
}
