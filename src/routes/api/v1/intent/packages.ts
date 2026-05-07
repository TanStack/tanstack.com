import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/intent/packages')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ applyIntentRateLimit, intentJsonResponse }, fns] =
          await Promise.all([
            import('~/utils/intent-api.server'),
            import('~/utils/intent.functions'),
          ])

        const decision = await applyIntentRateLimit(request)
        if (decision.limited) return decision.response

        const url = new URL(request.url)
        const search = url.searchParams.get('q') ?? undefined
        const framework = url.searchParams.get('framework') ?? undefined
        const sortParam = url.searchParams.get('sort')
        const sort: 'downloads' | 'name' | 'skills' | 'newest' | undefined =
          sortParam === 'downloads' ||
          sortParam === 'name' ||
          sortParam === 'skills' ||
          sortParam === 'newest'
            ? sortParam
            : undefined
        const page = parseInt(url.searchParams.get('page') ?? '0', 10) || 0
        const pageSize = Math.min(
          Math.max(parseInt(url.searchParams.get('pageSize') ?? '24', 10) || 24, 1),
          100,
        )

        const result = await fns.getIntentDirectory({
          data: { search, framework, sort, page, pageSize },
        })

        return intentJsonResponse(result, decision.rl)
      },
    },
  },
})
