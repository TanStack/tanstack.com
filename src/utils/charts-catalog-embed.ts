export const chartsCatalogEmbedPrefix = '/charts/catalog/embed/'

export type ChartsCatalogEmbed = {
  caseId: string
  origin: string
}

export type ChartsCatalogEmbedTheme = 'system' | 'light' | 'dark'

export function isChartsCatalogEmbedPath(pathname: string) {
  return /^\/charts\/catalog\/embed\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(pathname)
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
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (value === null || !isBoundedInteger(value, minimum, maximum)) {
    return fallback
  }
  return Number(value)
}

function isBoundedInteger(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return false
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
}
