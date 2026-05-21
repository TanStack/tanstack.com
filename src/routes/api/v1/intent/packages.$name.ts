import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/intent/packages/$name')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { name: string }
      }) => {
        const [{ applyIntentRateLimit, intentJsonResponse, intentErrorResponse }, fns] =
          await Promise.all([
            import('~/utils/intent-api.server'),
            import('~/utils/intent.functions'),
          ])

        const decision = await applyIntentRateLimit(request)
        if (decision.limited) return decision.response

        const detail = await fns.getIntentPackageDetail({
          data: { name: params.name },
        })

        if (!detail) {
          return intentErrorResponse(
            `Package not found: ${params.name}`,
            'NOT_FOUND',
            404,
            decision.rl,
          )
        }

        return intentJsonResponse(detail, decision.rl)
      },
    },
  },
})
