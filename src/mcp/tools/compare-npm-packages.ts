import { z } from 'zod'
import { fetchNpmDownloadsBulk } from '~/utils/stats.server'

const rangeOptions = [
  '7-days',
  '30-days',
  '90-days',
  '180-days',
  '365-days',
  '730-days',
  'all-time',
] as const

const binTypeOptions = ['daily', 'weekly', 'monthly'] as const

export const compareNpmPackagesSchema = z.object({
  packages: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('Package names to compare (max 10)'),
  range: z
    .enum(rangeOptions)
    .optional()
    .default('30-days')
    .describe('Time range for comparison. Default: 30-days'),
  binType: z
    .enum(binTypeOptions)
    .optional()
    .default('weekly')
    .describe('Aggregation level. Default: weekly'),
})

export type CompareNpmPackagesInput = z.infer<typeof compareNpmPackagesSchema>

function getDateRange(range: (typeof rangeOptions)[number]): {
  startDate: string
  endDate: string
} {
  const today = new Date()
  const endDate = today.toISOString().substring(0, 10)

  if (range === 'all-time') {
    return { startDate: '2015-01-10', endDate }
  }

  const days = parseInt(range.split('-')[0])
  const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 10)

  return { startDate, endDate }
}

function aggregateByBin(
  data: Array<{ day: string; downloads: number }>,
  binType: (typeof binTypeOptions)[number],
): Array<{ date: string; downloads: number }> {
  if (binType === 'daily') {
    return data.map((d) => ({ date: d.day, downloads: d.downloads }))
  }

  const binned = new Map<string, number>()

  for (const point of data) {
    const date = new Date(point.day)
    let binKey: string

    if (binType === 'weekly') {
      const startOfWeek = new Date(date)
      startOfWeek.setDate(date.getDate() - date.getDay())
      binKey = startOfWeek.toISOString().substring(0, 10)
    } else {
      binKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }

    binned.set(binKey, (binned.get(binKey) ?? 0) + point.downloads)
  }

  return Array.from(binned.entries())
    .map(([date, downloads]) => ({ date, downloads }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function compareNpmPackages(input: CompareNpmPackagesInput) {
  const { startDate, endDate } = getDateRange(input.range ?? '30-days')
  const binType = input.binType ?? 'weekly'

  // Use the existing bulk fetch function - each package as its own group
  const results = await fetchNpmDownloadsBulk({
    data: {
      packageGroups: input.packages.map((name) => ({
        packages: [{ name }],
      })),
      startDate,
      endDate,
    },
  })

  // Process results
  const packages = results.map((group, index) => {
    const pkg = group.packages[0]
    const downloads = pkg.downloads as Array<{ day: string; downloads: number }>

    const totalDownloads = downloads.reduce((sum, d) => sum + d.downloads, 0)
    const days = Math.max(1, downloads.length)
    const averagePerDay = Math.round(totalDownloads / days)

    const binnedData = aggregateByBin(downloads, binType)

    return {
      name: input.packages[index],
      totalDownloads,
      averagePerDay,
      data: binnedData,
    }
  })

  // Sort by total downloads descending
  packages.sort((a, b) => b.totalDownloads - a.totalDownloads)

  return {
    packages,
    range: { start: startDate, end: endDate },
    binType,
  }
}
