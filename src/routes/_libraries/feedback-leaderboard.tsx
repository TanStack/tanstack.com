import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { FeedbackLeaderboard } from '~/components/FeedbackLeaderboard'
import { getDocFeedbackLeaderboardQueryOptions } from '~/queries/docFeedback'

export const Route = createFileRoute('/_libraries/feedback-leaderboard')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  validateSearch: (search) => {
    const parsed = z
      .object({
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(50).catch(50),
      })
      .parse(search)

    return parsed
  },
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
