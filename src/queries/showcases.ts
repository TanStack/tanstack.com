import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  adminDeleteShowcase,
  deleteShowcase,
  getApprovedShowcases,
  getFeaturedShowcases,
  getMyShowcases,
  getMyShowcaseVotes,
  getRelatedShowcases,
  getShowcase,
  getShowcasesByLibrary,
  listShowcasesForModeration,
  setShowcaseFeatured,
  voteShowcase,
} from '~/utils/showcase.functions'
import type { ShowcaseStatus, ShowcaseUseCase } from '~/db/types'

export interface ShowcasePagination {
  page: number
  pageSize: number
}

export interface ShowcaseFilters {
  placement?: import('~/db/types').ShowcasePlacement
  status?: ShowcaseStatus[]
  libraryId?: string[]
  useCases?: ShowcaseUseCase[]
  userId?: string
  isFeatured?: boolean
  featured?: boolean
}

export const showcasesQueries = {
  all: () => ['showcases'],
  mine: () => [...showcasesQueries.all(), 'mine'],
  mineList: (params: { pagination: ShowcasePagination }) =>
    queryOptions({
      queryKey: [...showcasesQueries.mine(), params],
      queryFn: () => getMyShowcases({ data: params }),
    }),
  approved: (params: {
    pagination: ShowcasePagination
    filters?: {
      placement?: 'showcase' | 'community'
      libraryIds?: string[]
      useCases?: ShowcaseUseCase[]
      featured?: boolean
      hasSourceCode?: boolean
      q?: string
    }
  }) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'approved', params],
      queryFn: () => getApprovedShowcases({ data: params }),
    }),
  byLibrary: (params: { libraryId: string; limit?: number }) =>
    queryOptions({
      queryKey: [
        ...showcasesQueries.all(),
        'library',
        params.libraryId,
        params.limit,
      ],
      queryFn: () =>
        getShowcasesByLibrary({
          data: { libraryId: params.libraryId, limit: params.limit ?? 6 },
        }),
    }),
  featured: (params: { limit?: number }) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'featured', params.limit],
      queryFn: () =>
        getFeaturedShowcases({ data: { limit: params.limit ?? 6 } }),
    }),
  moderation: (params: {
    pagination: ShowcasePagination
    filters?: ShowcaseFilters
  }) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'moderation', params],
      queryFn: () => listShowcasesForModeration({ data: params }),
      staleTime: 0,
    }),
  detail: (showcaseId: string) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'detail', showcaseId],
      queryFn: () => getShowcase({ data: { showcaseId } }),
    }),
  myVotes: (showcaseIds: string[]) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'votes', 'mine', showcaseIds],
      queryFn: () => getMyShowcaseVotes({ data: { showcaseIds } }),
      enabled: showcaseIds.length > 0,
    }),
  related: (params: {
    showcaseId: string
    libraries: string[]
    limit?: number
  }) =>
    queryOptions({
      queryKey: [...showcasesQueries.all(), 'related', params.showcaseId],
      queryFn: () =>
        getRelatedShowcases({
          data: {
            showcaseId: params.showcaseId,
            libraries: params.libraries,
            limit: params.limit ?? 4,
          },
        }),
      enabled: params.libraries.length > 0,
    }),
}

export const showcasesMutations = {
  vote: () =>
    mutationOptions({
      mutationFn: (params: { showcaseId: string; value: 1 | -1 }) =>
        voteShowcase({ data: params }),
    }),
  setFeatured: () => mutationOptions({ mutationFn: setShowcaseFeatured }),
  delete: () => mutationOptions({ mutationFn: deleteShowcase }),
  adminDelete: () => mutationOptions({ mutationFn: adminDeleteShowcase }),
}
