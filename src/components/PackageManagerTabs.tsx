import * as React from 'react'
import {
  useLocalCurrentFramework,
} from './FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { Tabs, type TabDefinition } from './Tabs'
import { CodeBlock } from './CodeBlock'
import type { Framework } from '~/libraries/types'

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'
type InstallMode = 'install' | 'dev-install'

type PackageManagerTabsProps = {
  id: string
  packagesByFramework: Record<string, string[]>
  mode: InstallMode
  frameworks: Framework[]
}

const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']

function getInstallCommand(
  packageManager: PackageManager,
  packages: string[],
  mode: InstallMode,
): string[] {
  const commands: string[] = []

  if (mode === 'dev-install') {
    for (const pkg of packages) {
      switch (packageManager) {
        case 'npm':
          commands.push(`npm i -D ${pkg}`)
          break
        case 'pnpm':
          commands.push(`pnpm add -D ${pkg}`)
          break
        case 'yarn':
          commands.push(`yarn add -D ${pkg}`)
          break
        case 'bun':
          commands.push(`bun add -d ${pkg}`)
          break
      }
    }
    return commands
  }

  // install mode
  for (const pkg of packages) {
    switch (packageManager) {
      case 'npm':
        commands.push(`npm i ${pkg}`)
        break
      case 'pnpm':
        commands.push(`pnpm add ${pkg}`)
        break
      case 'yarn':
        commands.push(`yarn add ${pkg}`)
        break
      case 'bun':
        commands.push(`bun add ${pkg}`)
        break
    }
  }
  return commands
}

export function PackageManagerTabs({
  id,
  packagesByFramework,
  mode,
}: PackageManagerTabsProps) {
  const [storedPackageManager, setStoredPackageManager] =
    useLocalStorage<PackageManager>('packageManager', PACKAGE_MANAGERS[0])

  const { framework: paramsFramework } = useParams({ strict: false })
  const localCurrentFramework = useLocalCurrentFramework()
  const userQuery = useCurrentUserQuery()
  const userFramework = userQuery.data?.lastUsedFramework

  const actualFramework = (paramsFramework ||
    userFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  const normalizedFramework = actualFramework.toLowerCase()
  const packages = packagesByFramework[normalizedFramework]

  // Hide component if current framework not in package list
  if (!packages || packages.length === 0) {
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
    const commands = getInstallCommand(pm, packages, mode)
    const commandText = commands.join('\n')
    return (
      <CodeBlock key={pm}>
        <code className="language-bash">{commandText}</code>
      </CodeBlock>
    )
  })

  return (
    <Tabs
      id={id}
      tabs={tabs}
      children={children}
      activeSlug={selectedPackageManager}
      onTabChange={(slug) => setStoredPackageManager(slug as PackageManager)}
    />
  )
}
