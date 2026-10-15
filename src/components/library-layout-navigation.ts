import type { MenuItem } from '~/utils/config'

export function isChartsCatalogTarget(to: string) {
  return to === '/charts/catalog' || to.startsWith('/charts/catalog/')
}

export function getLibraryLayoutVersion({
  layoutVersion,
  pathname,
  routeVersion,
}: {
  layoutVersion: string
  pathname: string
  routeVersion: unknown
}) {
  if (typeof routeVersion === 'string') return routeVersion
  return isChartsCatalogTarget(pathname) ? 'latest' : layoutVersion
}

export function getLibraryTabLinkOptions({
  libraryId,
  version,
  to,
}: {
  libraryId: string
  version: string
  to: string
}) {
  const isHomeTarget = to === '..'

  return {
    from:
      isHomeTarget || isChartsCatalogTarget(to)
        ? undefined
        : '/$libraryId/$version/docs',
    to: isHomeTarget ? `/${libraryId}/${version}` : to,
    params:
      !isHomeTarget && (!to.startsWith('/') || to.includes('/$libraryId'))
        ? { libraryId, version }
        : undefined,
  }
}

function normalizeMenuPath(path: string) {
  return path.replace(/\/+$/, '')
}

export function isMenuTargetActive(
  to: string,
  relativePathname: string | undefined,
  pathname: string,
) {
  if (to === relativePathname) {
    return true
  }

  return (
    isChartsCatalogTarget(to) &&
    normalizeMenuPath(to) === normalizeMenuPath(pathname)
  )
}

export function getMenuGroupInitialOpenState(
  groups: MenuItem[],
  relativePathname: string | undefined,
  pathname: string,
) {
  const state: Record<string, boolean> = {}

  groups.forEach((group, index) => {
    const isChildActive = group.children.some((child) =>
      isMenuTargetActive(child.to, relativePathname, pathname),
    )
    const key = `${index}:${String(group.label)}`

    state[key] = isChildActive
      ? true
      : typeof group.defaultCollapsed !== 'undefined'
        ? !group.defaultCollapsed
        : false
  })

  return state
}
