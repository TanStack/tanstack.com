import { createServerFn } from '@tanstack/react-start'
import {
  fetchNpmDownloadsBulk as fetchNpmDownloadsBulkServer,
  fetchRecentDownloadStats as fetchRecentDownloadStatsServer,
  getOSSStats as getOSSStatsServer,
  type RecentDownloadStatsQueryParams,
  type StatsQueryParams,
} from './stats.server'

export type { StatsQueryParams } from './stats.server'

export const getOSSStats = createServerFn({ method: 'POST' })
  .inputValidator((data: StatsQueryParams) => data)
  .handler(async ({ data }) => getOSSStatsServer({ data }))

export const fetchNpmDownloadsBulk = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      packageGroups: Array<{
        packages: Array<{
          hidden?: boolean
          name: string
        }>
      }>
      startDate: string
      endDate: string
    }) => data,
  )
  .handler(async ({ data }) => fetchNpmDownloadsBulkServer({ data }))

export const fetchRecentDownloadStats = createServerFn({ method: 'POST' })
  .inputValidator((data: RecentDownloadStatsQueryParams) => data)
  .handler(async ({ data }) => fetchRecentDownloadStatsServer({ data }))
