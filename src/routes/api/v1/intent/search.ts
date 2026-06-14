import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/intent/search')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [
          {
            applyIntentRateLimit,
            intentJsonResponse,
            intentErrorResponse,
            buildSkillContentUrls,
          },
          dbModule,
        ] = await Promise.all([
          import('~/utils/intent-api.server'),
          import('~/utils/intent-db.server'),
        ])

        const decision = await applyIntentRateLimit(request)
        if (decision.limited) return decision.response

        const url = new URL(request.url)
        const q = url.searchParams.get('q')?.trim() ?? ''
        const limitParam = url.searchParams.get('limit')
        const limit = Math.min(
          Math.max(parseInt(limitParam ?? '20', 10) || 20, 1),
          100,
        )

        if (!q) {
          return intentErrorResponse(
            'Missing required query parameter: q',
            'INVALID_REQUEST',
            400,
            decision.rl,
          )
        }

        const rows = await dbModule.searchSkills(q, limit)
        const results = rows.map((row) => ({
          ...row,
          content: buildSkillContentUrls(
            row.packageName,
            row.version,
            row.skillPath,
          ),
        }))
        return intentJsonResponse({ query: q, limit, results }, decision.rl)
      },
    },
  },
})
