import { z } from 'zod'

export const getNpmPackageDownloadsSchema = z.object({
  package: z.string().describe('Package name (e.g., "@tanstack/react-query")'),
  year: z
    .string()
    .optional()
    .describe(
      'Year in YYYY format or "current" for current year. Default: current year',
    ),
})

export type GetNpmPackageDownloadsInput = z.infer<
  typeof getNpmPackageDownloadsSchema
>

export async function getNpmPackageDownloads(
  input: GetNpmPackageDownloadsInput,
) {
  const { getBatchNpmDownloadChunks, setCachedNpmDownloadChunk } =
    await import('~/utils/stats-db.server')

  const NPM_STATS_START_DATE = '2015-01-10'
  const today = new Date().toISOString().substring(0, 10)
  const currentYear = new Date().getFullYear().toString()

  const year = input.year ?? 'current'
  const isCurrentYear = year === 'current' || year === currentYear

  let startDate: string
  let endDate: string

  if (year === 'current') {
    startDate = `${currentYear}-01-01`
    endDate = today
  } else {
    startDate = `${year}-01-01`
    endDate = `${year}-12-31`
  }

  if (startDate < NPM_STATS_START_DATE) {
    startDate = NPM_STATS_START_DATE
  }

  // Check if year is in the future
  const targetYear = parseInt(year === 'current' ? currentYear : year)
  if (targetYear > parseInt(currentYear)) {
    throw new Error(`Year ${year} is in the future`)
  }

  // Try cache first using batch function (returns updatedAt)
  const cachedChunks = await getBatchNpmDownloadChunks([
    {
      packageName: input.package,
      dateFrom: startDate,
      dateTo: endDate,
      binSize: 'daily',
    },
  ])

  const cacheKey = `${input.package}|${startDate}|${endDate}|daily`
  const cached = cachedChunks.get(cacheKey)

  if (cached) {
    // For current year, check if cache is from today
    if (isCurrentYear && !cached.isImmutable) {
      const cacheDate = cached.updatedAt
        ? new Date(cached.updatedAt).toISOString().substring(0, 10)
        : ''
      if (cacheDate === today) {
        return formatResult(input.package, year, cached.dailyData)
      }
      // Cache is stale, fall through to fetch
    } else {
      return formatResult(input.package, year, cached.dailyData)
    }
  }

  // Fetch from NPM API
  const response = await fetch(
    `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${input.package}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TanStack-Stats-MCP',
      },
    },
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Package "${input.package}" not found on npm`)
    }
    throw new Error(`NPM API error: ${response.status}`)
  }

  const result = await response.json()
  const downloads: Array<{ day: string; downloads: number }> =
    result.downloads || []

  // Cache the result
  const chunkData = {
    packageName: input.package,
    dateFrom: startDate,
    dateTo: endDate,
    binSize: 'daily' as const,
    totalDownloads: downloads.reduce((sum, d) => sum + d.downloads, 0),
    dailyData: downloads,
    isImmutable: !isCurrentYear,
  }

  setCachedNpmDownloadChunk(chunkData).catch(() => {})

  return formatResult(input.package, year, downloads)
}

function formatResult(
  packageName: string,
  year: string,
  data: Array<{ day: string; downloads: number }>,
) {
  const totalDownloads = data.reduce((sum, d) => sum + d.downloads, 0)

  return {
    package: packageName,
    year,
    totalDownloads,
    dayCount: data.length,
    averagePerDay:
      data.length > 0 ? Math.round(totalDownloads / data.length) : 0,
    data,
  }
}
