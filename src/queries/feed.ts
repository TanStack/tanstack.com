import { queryOptions } from '@tanstack/react-query'
import {
  listFeedEntries,
  getFeedEntry,
  getFeedEntryById,
  getFeedStats,
  getFeedFacetCounts,
  searchFeedEntries,
  getFeedConfig,
} from '~/utils/feed.functions'
import type { EntryType, ReleaseLevel } from '~/db/schema'

export interface FeedFilters {
  entryTypes?: EntryType[]
  libraries?: string[]
  partners?: string[]
  tags?: string[]
  releaseLevels?: ReleaseLevel[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
  includeHidden?: boolean
}

export interface ListFeedEntriesParams {
  pagination: {
    limit: number
    page?: number
  }
  filters?: FeedFilters
}

export const listFeedEntriesQueryOptions = (params: ListFeedEntriesParams) =>
  queryOptions({
    queryKey: ['feed', 'list', params],
    queryFn: () => listFeedEntries({ data: params }),
  })

export const getFeedEntryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['feed', 'entry', id],
    queryFn: () => getFeedEntry({ data: { id } }),
  })

export const getFeedEntryByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['feed', 'entryById', id],
    queryFn: () => getFeedEntryById({ data: { id } }),
  })

export const getFeedStatsQueryOptions = () =>
  queryOptions({
    queryKey: ['feed', 'stats'],
    queryFn: () => getFeedStats(),
  })

export const getFeedFacetCountsQueryOptions = (filters?: FeedFilters) =>
  queryOptions({
    queryKey: ['feed', 'facetCounts', filters],
    queryFn: () => getFeedFacetCounts({ data: { filters } }),
  })
