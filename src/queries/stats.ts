import { queryOptions } from '@tanstack/react-query'
import { getOSSStats } from '~/utils/stats.server'
import type {
  Library as StatsLibrary,
  StatsQueryParams,
} from '~/utils/stats.server'
import type { Library } from '~/libraries'

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

export function ossStatsQuery({ library }: { library?: Library } = {}) {
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
