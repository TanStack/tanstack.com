import { queryOptions } from '@tanstack/react-query'
import {
  fetchRecentDownloadStats,
  getOSSStats,
} from '~/utils/stats-queries.functions'
import type { StatsQueryParams } from '~/utils/stats-queries.functions'
import type { LibrarySlim } from '~/libraries'
import type { RecentDownloadStats } from '~/utils/stats.types'

export type { StatsQueryParams } from '~/utils/stats-queries.functions'

type RecentDownloadsLibrary = Pick<LibrarySlim, 'npmPackageNames'> & {
  frameworks?: LibrarySlim['frameworks']
  id: string
  repo?: LibrarySlim['repo']
}

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

export function recentDownloadsQuery({
  library,
}: {
  library: RecentDownloadsLibrary
}) {
  const queryLibrary = {
    id: library.id,
    npmPackageNames: library.npmPackageNames,
    repo: library.repo,
    frameworks: library.frameworks,
  }

  return queryOptions({
    queryKey: ['npm-recent-downloads', queryLibrary],
    queryFn: (): Promise<RecentDownloadStats> =>
      fetchRecentDownloadStats({ data: { library: queryLibrary } }),
    staleTime: 5 * 60 * 1000,
  })
}
