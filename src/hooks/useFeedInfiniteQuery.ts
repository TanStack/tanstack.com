import { useInfiniteQuery } from '@tanstack/react-query'
import { type FeedFilters } from '~/queries/feed'
import { listFeedEntries } from '~/utils/feed.functions'

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
          entryTypes: filters.entryTypes,
          libraries: filters.libraries,
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
      return listFeedEntries({
        data: {
          pagination: {
            limit: pageSize,
            page: pageParam,
          },
          filters: {
            entryTypes: filters.entryTypes,
            libraries: filters.libraries,
            partners: filters.partners,
            tags: filters.tags,
            releaseLevels: filters.releaseLevels as any,
            includePrerelease: filters.includePrerelease,
            featured: filters.featured,
            search: filters.search,
            includeHidden: filters.includeHidden,
          },
        },
      })
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
