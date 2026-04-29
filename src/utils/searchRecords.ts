export type SearchRouteStyle = 'canonical' | 'framework-path'

export type SearchHierarchy = {
  lvl0?: string | null
  lvl1?: string | null
  lvl2?: string | null
  lvl3?: string | null
  lvl4?: string | null
  lvl5?: string | null
  lvl6?: string | null
}

export type SearchRecord = {
  objectID: string
  url: string
  anchor?: string
  urlWithAnchor: string
  library: string
  framework: string
  version: string
  routeStyle: SearchRouteStyle
  hierarchy: SearchHierarchy
  content?: string
}

export type SearchHitFrameworkContext = {
  url: string
  framework?: string | null
  routeStyle?: SearchRouteStyle | null
}

function getPathname(url: string) {
  try {
    return new URL(url, 'https://tanstack.com').pathname
  } catch {
    return url.split('#')[0]?.split('?')[0] ?? url
  }
}

export function hasFrameworkPath(url: string) {
  const segments = getPathname(url).split('/').filter(Boolean)

  for (let index = 0; index < segments.length - 2; index++) {
    if (
      segments[index] === 'docs' &&
      segments[index + 1] === 'framework' &&
      segments[index + 2]
    ) {
      return true
    }
  }

  return false
}

export function shouldPersistFrameworkForHit(hit: SearchHitFrameworkContext) {
  const framework = hit.framework?.trim().toLowerCase()

  if (!framework || framework === 'all') {
    return false
  }

  if (hit.routeStyle === 'framework-path') {
    return false
  }

  return !hasFrameworkPath(hit.url)
}
