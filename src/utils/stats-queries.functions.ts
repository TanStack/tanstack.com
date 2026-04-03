import { createServerFn } from '@tanstack/react-start'
import type { LibrarySlim } from '~/libraries'
import {
  fetchNpmDownloadsBulk as fetchNpmDownloadsBulkServer,
  fetchRecentDownloadStats as fetchRecentDownloadStatsServer,
  getOSSStats as getOSSStatsServer,
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
  .inputValidator(
    (data: { library: Pick<LibrarySlim, 'frameworks' | 'id' | 'repo'> }) =>
      data,
  )
  .handler(async ({ data }) => fetchRecentDownloadStatsServer({ data }))
