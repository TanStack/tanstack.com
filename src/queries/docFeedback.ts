import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  createDocFeedback,
  deleteDocFeedback,
  getDocFeedbackForPage,
  getDocFeedbackLeaderboard,
  getUserDocFeedback,
  listDocFeedbackForModeration,
  moderateDocFeedback,
  updateDocFeedback,
  updateDocFeedbackCollapsed,
} from '~/utils/docFeedback.functions'
import type { DocFeedbackStatus, DocFeedbackType } from '~/db/types'

export interface DocFeedbackFilters {
  status?: DocFeedbackStatus[]
  type?: DocFeedbackType[]
  libraryId?: string
  isDetached?: boolean
  userId?: string
  dateFrom?: string
  dateTo?: string
}

export interface DocFeedbackPagination {
  page: number
  pageSize: number
}

export const docFeedbackQueries = {
  all: () => ['docFeedback'],
  user: (params: {
    pagination: DocFeedbackPagination
    filters?: {
      status?: DocFeedbackStatus[]
      libraryId?: string
      type?: DocFeedbackType[]
    }
  }) =>
    queryOptions({
      queryKey: [...docFeedbackQueries.all(), 'user', params],
      queryFn: () => getUserDocFeedback({ data: params }),
    }),
  moderations: () => [...docFeedbackQueries.all(), 'moderation'],
  moderation: (params: {
    pagination: DocFeedbackPagination
    filters?: DocFeedbackFilters
  }) =>
    queryOptions({
      queryKey: [...docFeedbackQueries.moderations(), params],
      queryFn: () => listDocFeedbackForModeration({ data: params }),
      staleTime: 0,
    }),
  leaderboard: (params: { pagination: DocFeedbackPagination }) =>
    queryOptions({
      queryKey: [...docFeedbackQueries.all(), 'leaderboard', params],
      queryFn: () => getDocFeedbackLeaderboard({ data: params }),
    }),
  page: (params: { pagePath: string; libraryVersion: string }) =>
    queryOptions({
      queryKey: [...docFeedbackQueries.all(), 'page', params],
      queryFn: () => getDocFeedbackForPage({ data: params }),
    }),
}

export const docFeedbackMutations = {
  create: () => mutationOptions({ mutationFn: createDocFeedback }),
  update: () => mutationOptions({ mutationFn: updateDocFeedback }),
  delete: () => mutationOptions({ mutationFn: deleteDocFeedback }),
  updateCollapsed: () =>
    mutationOptions({ mutationFn: updateDocFeedbackCollapsed }),
  moderate: () => mutationOptions({ mutationFn: moderateDocFeedback }),
}
