import { queryOptions } from '@tanstack/react-query'
import {
  fetchNpmDownloadsBulk,
  getOSSStats,
} from '~/utils/stats-queries.functions'
import type { StatsQueryParams } from '~/utils/stats-queries.functions'
import type { LibrarySlim } from '~/libraries'
import type { RecentDownloadStats } from '~/utils/stats.types'

export type { StatsQueryParams } from '~/utils/stats-queries.functions'

type NpmDownloadPoint = {
  day: string
  downloads: number
}

type NpmDownloadsBulkResult = Array<{
  packages: Array<{
    downloads: Array<NpmDownloadPoint>
  }>
}>

export const ossStatsQueryOptions = (params?: StatsQueryParams) =>
  queryOptions({
    queryKey: ['stats', 'oss', params],
    queryFn: () => getOSSStats({ data: { library: params?.library } }),
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
  })

export function ossStatsQuery({ library }: { library?: LibrarySlim } = {}) {
  return ossStatsQueryOptions({
    library: library
      ? {
          id: library.id,
          npmPackageNames: library.npmPackageNames,
          repo: library.repo,
          frameworks: library.frameworks,
        }
      : undefined,
  })
}

function toIsoDayUtc(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return toIsoDayUtc(date)
}

function getCompletedDownloadWindows(now = new Date()) {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const dayInMs = 24 * 60 * 60 * 1000
  const getDayAgo = (amount: number) =>
    toIsoDayUtc(new Date(todayUtc.getTime() - amount * dayInMs))

  return {
    dailyStart: getDayAgo(1),
    lastCompletedDay: getDayAgo(1),
    monthlyStart: getDayAgo(30),
    previousWeeklyEnd: getDayAgo(8),
    previousWeeklyStart: getDayAgo(14),
    sparklineStart: getDayAgo(364),
    weeklyStart: getDayAgo(7),
  }
}

function sumDownloadRange({
  downloads,
  end,
  start,
}: {
  downloads: Array<NpmDownloadPoint>
  end: string
  start: string
}) {
  return downloads.reduce((total, point) => {
    if (point.day < start || point.day > end) {
      return total
    }

    return total + point.downloads
  }, 0)
}

function getRecentDownloadPackageNames(library: LibrarySlim) {
  if (library.npmPackageNames?.length) {
    return library.npmPackageNames
  }

  return [`@tanstack/${library.id}`]
}

function getWeeklySparklineDownloads({
  downloads,
  end,
  start,
}: {
  downloads: Array<NpmDownloadPoint>
  end: string
  start: string
}) {
  const bucketCount = 52

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = addUtcDays(start, index * 7)
    const bucketEnd =
      index === bucketCount - 1 ? end : addUtcDays(bucketStart, 6)

    return {
      day: bucketStart,
      downloads: sumDownloadRange({
        downloads,
        start: bucketStart,
        end: bucketEnd,
      }),
    }
  })
}

export function recentDownloadsQuery({ library }: { library: LibrarySlim }) {
  const packageNames = getRecentDownloadPackageNames(library)
  const windows = getCompletedDownloadWindows()

  return queryOptions({
    queryKey: ['npm-recent-downloads', library.id, packageNames, windows],
    queryFn: async (): Promise<RecentDownloadStats> => {
      const statsResults: NpmDownloadsBulkResult = await fetchNpmDownloadsBulk({
        data: {
          packageGroups: [
            {
              packages: packageNames.map((name) => ({ name })),
            },
          ],
          startDate: windows.sparklineStart,
          endDate: windows.lastCompletedDay,
        },
      })

      const downloads = statsResults.flatMap((result) =>
        result.packages.flatMap((pkg) => pkg.downloads),
      )

      return {
        dailyDownloads: sumDownloadRange({
          downloads,
          start: windows.dailyStart,
          end: windows.lastCompletedDay,
        }),
        monthlyDownloads: sumDownloadRange({
          downloads,
          start: windows.monthlyStart,
          end: windows.lastCompletedDay,
        }),
        previousWeeklyDownloads: sumDownloadRange({
          downloads,
          start: windows.previousWeeklyStart,
          end: windows.previousWeeklyEnd,
        }),
        sparklineDownloads: getWeeklySparklineDownloads({
          downloads,
          start: windows.sparklineStart,
          end: windows.lastCompletedDay,
        }),
        updatedAt: Date.now(),
        weeklyDownloads: sumDownloadRange({
          downloads,
          start: windows.weeklyStart,
          end: windows.lastCompletedDay,
        }),
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
