import * as React from 'react'
import { useCurrentFramework } from './FrameworkSelect'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { Tabs, type TabDefinition } from './Tabs'
import { CodeBlock } from './CodeBlock'
import type { Framework } from '~/libraries/types'

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'
type InstallMode = 'install' | 'dev-install'

type PackageManagerTabsProps = {
  id: string
  packagesByFramework: Record<string, string>
  mode: InstallMode
  frameworks: Framework[]
}

const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']

function getInstallCommand(
  packageManager: PackageManager,
  packages: string,
  mode: InstallMode,
): string {
  if (mode === 'dev-install') {
    switch (packageManager) {
      case 'npm':
        return `npm i -D ${packages}`
      case 'pnpm':
        return `pnpm add -D ${packages}`
      case 'yarn':
        return `yarn add -D ${packages}`
      case 'bun':
        return `bun add -d ${packages}`
    }
  }

  // install mode
  switch (packageManager) {
    case 'npm':
      return `npm i ${packages}`
    case 'pnpm':
      return `pnpm add ${packages}`
    case 'yarn':
      return `yarn add ${packages}`
    case 'bun':
      return `bun add ${packages}`
  }
}

export function PackageManagerTabs({
  id,
  packagesByFramework,
  mode,
  frameworks,
}: PackageManagerTabsProps) {
  const { framework: currentFramework } = useCurrentFramework(frameworks)
  const [storedPackageManager, setStoredPackageManager] =
    useLocalStorage<PackageManager>('packageManager', PACKAGE_MANAGERS[0])

  // Normalize framework key to lowercase for lookup
  const normalizedFramework = currentFramework.toLowerCase()
  const packages = packagesByFramework[normalizedFramework]

  // Hide component if current framework not in package list
  if (!packages) {
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
    const command = getInstallCommand(pm, packages, mode)
    return (
      <CodeBlock key={pm}>
        <code className="language-bash">{command}</code>
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
