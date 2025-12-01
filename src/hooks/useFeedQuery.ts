import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export interface FeedFilters {
  sources?: string[]
  libraries?: string[]
  categories?: string[]
  partners?: string[]
  tags?: string[]
  releaseLevels?: ('major' | 'minor' | 'patch')[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
  includeHidden?: boolean
}

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
    ...convexQuery(api.feed.queries.listFeedEntries, {
      pagination: {
        limit: pageSize,
        page: page - 1,
      },
      filters: {
        sources: filters.sources,
        libraries: filters.libraries,
        categories: filters.categories,
        partners: filters.partners,
        tags: filters.tags,
        releaseLevels: filters.releaseLevels,
        includePrerelease: filters.includePrerelease,
        featured: filters.featured,
        search: filters.search,
        includeHidden: filters.includeHidden,
      },
    }),
    placeholderData: keepPreviousData,
  })
}
