import { isChartsCatalogCaseId } from './charts-catalog'

export const chartsCatalogEmbedPrefix = '/charts/catalog/embed/'

export type ChartsCatalogEmbed = {
  caseId: string
  origin: string
}

export type ChartsCatalogEmbedTheme = 'system' | 'light' | 'dark'

export type ChartsCatalogEmbedLoaderDeps = {
  height: number
  revision: number
  theme: ChartsCatalogEmbedTheme
}

export type ChartsCatalogEmbedRouteSearch = {
  height?: string | number | Array<string | number>
  revision?: string | number | Array<string | number>
  theme?: string | number | Array<string | number>
}

export function isChartsCatalogEmbedPath(pathname: string) {
  if (
    !pathname.startsWith(chartsCatalogEmbedPrefix) ||
    !pathname.endsWith('/')
  ) {
    return false
  }
  return isChartsCatalogCaseId(
    pathname.slice(chartsCatalogEmbedPrefix.length, -1),
  )
}

export function parseChartsCatalogEmbed(
  source: string | undefined,
): ChartsCatalogEmbed | null {
  if (!source) return null

  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'tanstack.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !isChartsCatalogEmbedPath(url.pathname)
  ) {
    return null
  }

  const allowedParameters = new Set(['height', 'revision', 'theme'])
  for (const key of url.searchParams.keys()) {
    if (!allowedParameters.has(key)) return null
  }

  const theme = url.searchParams.get('theme')
  if (theme !== null && !isChartsCatalogEmbedTheme(theme)) return null

  const height = url.searchParams.get('height')
  if (height !== null && !isBoundedInteger(height, 120, 1_200)) return null

  const revision = url.searchParams.get('revision')
  if (revision !== null && !isBoundedInteger(revision, 0, 10_000)) return null

  return {
    caseId: url.pathname.slice(chartsCatalogEmbedPrefix.length, -1),
    origin: url.origin,
  }
}

export function isChartsCatalogEmbedTheme(
  value: unknown,
): value is ChartsCatalogEmbedTheme {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function parseChartsCatalogEmbedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    return value
  }
  if (typeof value !== 'string' || !isBoundedInteger(value, minimum, maximum)) {
    return fallback
  }
  return Number(value)
}

export function validateChartsCatalogEmbedRouteSearch(
  search: Record<string, unknown>,
): ChartsCatalogEmbedRouteSearch {
  const height = getChartsCatalogEmbedRouteSearchValue(search.height)
  const revision = getChartsCatalogEmbedRouteSearchValue(search.revision)
  const theme = getChartsCatalogEmbedRouteSearchValue(search.theme)

  return {
    ...(height === undefined ? {} : { height }),
    ...(revision === undefined ? {} : { revision }),
    ...(theme === undefined ? {} : { theme }),
  }
}

export function parseChartsCatalogEmbedRouteSearch(
  search: ChartsCatalogEmbedRouteSearch,
): ChartsCatalogEmbedLoaderDeps {
  return {
    height: parseChartsCatalogEmbedInteger(search.height, 360, 120, 1_200),
    revision: parseChartsCatalogEmbedInteger(search.revision, 0, 0, 10_000),
    theme: isChartsCatalogEmbedTheme(search.theme) ? search.theme : 'system',
  }
}

function isBoundedInteger(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return false
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
}

function getChartsCatalogEmbedRouteSearchValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (
    Array.isArray(value) &&
    value.every(
      (entry): entry is string | number =>
        typeof entry === 'string' || typeof entry === 'number',
    )
  ) {
    return value
  }
  return undefined
}
