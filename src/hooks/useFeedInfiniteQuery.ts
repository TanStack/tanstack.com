import { useInfiniteQuery } from '@tanstack/react-query'
import { listFeedEntriesQueryOptions, type FeedFilters } from '~/queries/feed'

export interface UseFeedInfiniteQueryOptions {
  pageSize?: number
  filters: FeedFilters
}

export function useFeedInfiniteQuery({
  pageSize = 20,
  filters,
}: UseFeedInfiniteQueryOptions) {
  return useInfiniteQuery({
    queryKey: [
      'feed',
      'infinite',
      {
        pageSize,
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
      },
    ],
    queryFn: ({ pageParam = 0 }) => {
      return listFeedEntriesQueryOptions({
        pagination: {
          limit: pageSize,
          page: pageParam,
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
      }).queryFn()
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.isDone) {
        return undefined
      }
      return allPages.length
    },
    initialPageParam: 0,
  })
}
