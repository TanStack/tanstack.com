import { redirect, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { FeedbackModerationPage } from '~/components/FeedbackModerationPage'
import { listDocFeedbackForModerationQueryOptions } from '~/queries/docFeedback'
import { requireCapability } from '~/utils/auth.server'
import { libraryIdSchema, docFeedbackStatusSchema } from '~/utils/schemas'

const searchSchema = v.object({
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50),
  status: v.optional(v.array(docFeedbackStatusSchema)),
  libraryId: v.optional(libraryIdSchema),
  isDetached: v.optional(v.boolean()),
  dateFrom: v.optional(v.string()),
  dateTo: v.optional(v.string()),
})

export const Route = createFileRoute('/admin/feedback/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  beforeLoad: async () => {
    try {
      const user = await requireCapability({
        data: { capability: 'moderate-feedback' },
      })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    status: search.status,
    libraryId: search.libraryId,
    isDetached: search.isDetached,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      listDocFeedbackForModerationQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: deps.pageSize,
        },
        filters: {
          status: deps.status,
          type: ['improvement'], // Only improvements
          libraryId: deps.libraryId,
          isDetached: deps.isDetached,
          dateFrom: deps.dateFrom,
          dateTo: deps.dateTo,
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'private, max-age=0, must-revalidate',
  }),
  component: FeedbackModerationPage,
  head: () => ({
    meta: seo({
      title: 'Moderate Feedback | Admin | TanStack',
      description: 'Moderate documentation feedback submissions',
    }),
  }),
})
