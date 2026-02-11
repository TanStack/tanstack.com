import { createFileRoute } from '@tanstack/react-router'
import { loadRemoteTemplateHandler } from '~/builder/api'
import { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } from '~/utils/rateLimit.server'

export const Route = createFileRoute('/api/builder/load-template')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.builderRemote)
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit)
        }

        try {
          const body = await request.json()
          const templateUrl = body.url

          if (!templateUrl) {
            return new Response(JSON.stringify({ error: 'URL is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const response = await loadRemoteTemplateHandler(templateUrl)
          return new Response(JSON.stringify(response), {
            status: response.error ? 400 : 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid request body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
