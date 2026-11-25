import { queryOptions } from '@tanstack/react-query'
import {
  fetchRecentDownloadStats,
  getHomepageNpmStatsSummary,
  getOSSStats,
} from '~/utils/stats-queries.functions'
import type { StatsQueryParams } from '~/utils/stats-queries.functions'
import type { RecentDownloadStats } from '~/utils/stats.types'

export type { StatsQueryParams } from '~/utils/stats-queries.functions'

type StatsQueryLibrary = NonNullable<StatsQueryParams['library']>
type RecentDownloadsLibrary = StatsQueryLibrary

export const statsQueries = {
  all: () => ['stats'],
  oss: () => [...statsQueries.all(), 'oss'],
  ossSummary: ({ library }: { library?: StatsQueryLibrary } = {}) => {
    const params: StatsQueryParams = {
      library: library
        ? {
            id: library.id,
            npmPackageNames: library.npmPackageNames,
            repo: library.repo,
            frameworks: library.frameworks,
          }
        : undefined,
    }

    return queryOptions({
      queryKey: [...statsQueries.oss(), params],
      queryFn: () => getOSSStats({ data: { library: params.library } }),
      staleTime: 1000 * 60 * 15, // Cache for 15 minutes
    })
  },
  homepageNpmSummary: () =>
    queryOptions({
      queryKey: [...statsQueries.all(), 'homepage-npm-summary'],
      queryFn: () => getHomepageNpmStatsSummary(),
      staleTime: 1000 * 60 * 15,
    }),
  recentDownloads: ({ library }: { library: RecentDownloadsLibrary }) => {
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
  },
}
