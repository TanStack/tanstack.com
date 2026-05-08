import type { ReactNode } from 'react'
import type { MenuItem } from './config'

export const docsNavTabIds = [
  'get-started',
  'tutorial',
  'guides',
  'api',
  'examples',
  'community',
] as const

export type DocsNavTabId = (typeof docsNavTabIds)[number]

export const docsNavTabs: Array<{ id: DocsNavTabId; label: string }> = [
  { id: 'get-started', label: 'Get Started' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'guides', label: 'Guides' },
  { id: 'api', label: 'API' },
  { id: 'examples', label: 'Examples' },
  { id: 'community', label: 'Community' },
]

function getLabelText(label: ReactNode) {
  return typeof label === 'string' ? label : ''
}

function getFallbackDocsNavTabId(
  group: MenuItem,
  child: MenuItem['children'][number],
): DocsNavTabId {
  const groupLabel = getLabelText(group.label).toLowerCase()
  const childLabel = getLabelText(child.label).toLowerCase()
  const to = child.to.toLowerCase()
  const searchText = `${groupLabel} ${childLabel} ${to}`

  if (
    child.to.startsWith('http') ||
    searchText.includes('community') ||
    searchText.includes('contributors') ||
    searchText.includes('npm-stats') ||
    searchText.includes('npm stats') ||
    searchText.includes('github') ||
    searchText.includes('discord') ||
    searchText.includes('youtube')
  ) {
    return 'community'
  }

  if (searchText.includes('example')) {
    return 'examples'
  }

  if (
    to.includes('/api/') ||
    to.startsWith('api/') ||
    to.includes('/reference/') ||
    to.startsWith('reference/') ||
    groupLabel.includes('api') ||
    groupLabel.includes('reference')
  ) {
    return 'api'
  }

  if (searchText.includes('tutorial')) {
    return 'tutorial'
  }

  if (
    groupLabel.includes('get started') ||
    groupLabel.includes('getting started') ||
    groupLabel.includes('overview') ||
    childLabel === 'home' ||
    childLabel === 'frameworks' ||
    searchText.includes('installation') ||
    searchText.includes('quick-start') ||
    searchText.includes('quick start') ||
    searchText.includes('introduction') ||
    searchText.includes('overview')
  ) {
    return 'get-started'
  }

  return 'guides'
}

export function getDocsNavTabId(
  group: MenuItem,
  child: MenuItem['children'][number],
) {
  return child.tab ?? group.tab ?? getFallbackDocsNavTabId(group, child)
}

export function getTabbedMenuConfig(menuConfig: MenuItem[]) {
  return docsNavTabs
    .map((tab) => {
      const groups = menuConfig
        .map((group) => {
          const children = group.children.filter((child) => {
            return getDocsNavTabId(group, child) === tab.id
          })

          return children.length
            ? {
                ...group,
                children,
              }
            : undefined
        })
        .filter((group): group is MenuItem => group !== undefined)

      return {
        ...tab,
        groups,
        firstItem: groups
          .flatMap((group) => group.children)
          .find((child) => !child.to.startsWith('http')),
      }
    })
    .filter((tab) => tab.groups.length)
}

export function getActiveDocsNavTabId({
  isExample,
  menuConfig,
  pathname,
  relativePathname,
}: {
  isExample: boolean
  menuConfig: MenuItem[]
  pathname: string
  relativePathname: string
}) {
  if (isExample) {
    return 'examples'
  }

  const activeGroup = menuConfig.find((group) =>
    group.children.some((child) => child.to === relativePathname),
  )
  const activeChild = activeGroup?.children.find(
    (child) => child.to === relativePathname,
  )

  if (activeGroup && activeChild) {
    return getDocsNavTabId(activeGroup, activeChild)
  }

  if (pathname.includes('/docs/api/') || pathname.includes('/docs/reference/')) {
    return 'api'
  }

  if (pathname.includes('/docs/tutorial')) {
    return 'tutorial'
  }

  if (
    pathname.includes('/docs/community') ||
    pathname.includes('/docs/contributors') ||
    pathname.includes('/docs/npm-stats')
  ) {
    return 'community'
  }

  return 'get-started'
}
