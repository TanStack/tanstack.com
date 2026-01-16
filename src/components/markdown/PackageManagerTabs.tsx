import { useLocalCurrentFramework } from '../FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import { create } from 'zustand'
import { Tabs, type TabDefinition } from './Tabs'
import { CodeBlock } from './CodeBlock'
import type { Framework } from '~/libraries/types'

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'
type InstallMode =
  | 'install'
  | 'dev-install'
  | 'local-install'
  | 'create'
  | 'custom'

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

const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']

function getInstallCommand(
  packageManager: PackageManager,
  packageGroups: string[][],
  mode: InstallMode,
): string[] {
  const commands: string[] = []

  if (mode === 'custom') {
    for (const packages of packageGroups) {
      const pkgStr = packages.join(' ')
      switch (packageManager) {
        case 'npm':
          commands.push(`npm ${pkgStr}`)
          break
        case 'pnpm':
          commands.push(`pnpm ${pkgStr}`)
          break
        case 'yarn':
          commands.push(`yarn ${pkgStr}`)
          break
        case 'bun':
          commands.push(`bun ${pkgStr}`)
          break
      }
    }
  }

  if (mode === 'create') {
    for (const packages of packageGroups) {
      const pkgStr = packages.join(' ')
      switch (packageManager) {
        case 'npm':
          commands.push(`npm create ${pkgStr}`)
          break
        case 'pnpm':
          commands.push(`pnpm create ${pkgStr}`)
          break
        case 'yarn':
          commands.push(`yarn create ${pkgStr}`)
          break
        case 'bun':
          commands.push(`bun create ${pkgStr}`)
          break
      }
    }
  }

  if (mode === 'local-install') {
    // Each group becomes one command line
    for (const packages of packageGroups) {
      const pkgStr = packages.join(' ')
      switch (packageManager) {
        case 'npm':
          commands.push(`npx ${pkgStr}`)
          break
        case 'pnpm':
          commands.push(`pnpx ${pkgStr}`)
          break
        case 'yarn':
          commands.push(`yarn dlx ${pkgStr}`)
          break
        case 'bun':
          commands.push(`bunx ${pkgStr}`)
          break
      }
    }
    return commands
  }

  if (mode === 'dev-install') {
    for (const packages of packageGroups) {
      const pkgStr = packages.join(' ')
      switch (packageManager) {
        case 'npm':
          commands.push(`npm i -D ${pkgStr}`)
          break
        case 'pnpm':
          commands.push(`pnpm add -D ${pkgStr}`)
          break
        case 'yarn':
          commands.push(`yarn add -D ${pkgStr}`)
          break
        case 'bun':
          commands.push(`bun add -d ${pkgStr}`)
          break
      }
    }
    return commands
  }

  // install mode
  for (const packages of packageGroups) {
    const pkgStr = packages.join(' ')
    switch (packageManager) {
      case 'npm':
        commands.push(`npm i ${pkgStr}`)
        break
      case 'pnpm':
        commands.push(`pnpm add ${pkgStr}`)
        break
      case 'yarn':
        commands.push(`yarn add ${pkgStr}`)
        break
      case 'bun':
        commands.push(`bun add ${pkgStr}`)
        break
    }
  }
  return commands
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
    return (
      <CodeBlock key={pm}>
        <code className="language-bash">{commandText}</code>
      </CodeBlock>
    )
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
