import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { FeedbackLeaderboard } from '~/components/FeedbackLeaderboard'
import { getDocFeedbackLeaderboardQueryOptions } from '~/queries/docFeedback'

const searchSchema = v.object({
  page: v.fallback(v.optional(v.number(), 1), 1),
  pageSize: v.fallback(
    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50),
    50,
  ),
})

export const Route = createFileRoute('/feedback-leaderboard')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      getDocFeedbackLeaderboardQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: deps.pageSize,
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    'Netlify-Vary': 'query=payload',
  }),
  component: FeedbackLeaderboard,
  head: () => ({
    meta: seo({
      title: 'Documentation Feedback Leaderboard | TanStack',
      description:
        'See the top contributors helping improve TanStack documentation through feedback and notes.',
    }),
  }),
})
