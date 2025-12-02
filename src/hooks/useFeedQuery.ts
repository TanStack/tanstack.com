import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listFeedEntriesQueryOptions, type FeedFilters } from '~/queries/feed'

export interface UseFeedQueryOptions {
  page: number
  pageSize?: number
  filters: FeedFilters
}

export function useFeedQuery({
  page,
  pageSize = 20,
  filters,
}: UseFeedQueryOptions) {
  return useQuery({
    ...listFeedEntriesQueryOptions({
      pagination: {
        limit: pageSize,
        page: page - 1,
      },
      filters: {
        sources: filters.sources,
        libraries: filters.libraries,
        categories: filters.categories as any,
        partners: filters.partners,
        tags: filters.tags,
        releaseLevels: filters.releaseLevels as any,
        includePrerelease: filters.includePrerelease,
        featured: filters.featured,
        search: filters.search,
        includeHidden: filters.includeHidden,
      },
    }),
    placeholderData: keepPreviousData,
  })
}
