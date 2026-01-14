import { queryOptions } from '@tanstack/react-query'
import { getOSSStats, fetchRecentDownloadStats } from '~/utils/stats.server'
import type { StatsQueryParams } from '~/utils/stats.server'
import type { LibrarySlim } from '~/libraries'

export type {
  Library as StatsLibrary,
  StatsQueryParams,
} from '~/utils/stats.server'

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
          repo: library.repo,
          frameworks: library.frameworks,
        }
      : undefined,
  })
}

export const recentDownloadStatsQueryOptions = (library: LibrarySlim) =>
  queryOptions({
    queryKey: ['stats', 'recent-downloads', library.id],
    queryFn: () => fetchRecentDownloadStats({
      data: {
        library: {
          id: library.id,
          repo: library.repo,
          frameworks: library.frameworks,
        },
      },
    }),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes (fresher than all-time stats)
  })

export function recentDownloadStatsQuery({ library }: { library: LibrarySlim }) {
  return recentDownloadStatsQueryOptions(library)
}
