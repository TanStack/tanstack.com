import { queryOptions } from '@tanstack/react-query'
import {
  listFeedEntries,
  getFeedEntry,
  getFeedEntryById,
  getFeedStats,
  getFeedFacetCounts,
} from '~/utils/feed.functions'
import type { EntryType, ReleaseLevel } from '~/db/types'
import type { LibraryId } from '~/libraries'

export interface FeedFilters {
  entryTypes?: EntryType[]
  libraries?: LibraryId[]
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

// Used by admin edit - returns raw content without RSC rendering
export const getFeedEntryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['feed', 'entry', 'raw', id],
    queryFn: () => getFeedEntry({ data: { id } }),
  })

// Used by detail page - returns pre-rendered contentRsc
export const getFeedEntryByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['feed', 'entry', 'rendered', id],
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
