import { queryOptions } from '@tanstack/react-query'
import { getOSSStats } from '~/utils/stats.server'
import type { Library, StatsQueryParams } from '~/utils/stats.server'

export type { Library, StatsQueryParams } from '~/utils/stats.server'

export const ossStatsQueryOptions = (params?: StatsQueryParams) =>
  queryOptions({
    queryKey: ['stats', 'oss', params],
    queryFn: () => getOSSStats({ data: { library: params?.library } }),
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
  })
