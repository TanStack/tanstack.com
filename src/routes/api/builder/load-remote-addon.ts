import { createFileRoute } from '@tanstack/react-router'
import { loadRemoteIntegrationHandler } from '~/builder/api'
import { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } from '~/utils/rateLimit.server'

export const Route = createFileRoute('/api/builder/load-remote-addon')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Rate limiting (30 requests/minute per IP)
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.builderRemote)
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit)
        }

        const url = new URL(request.url)
        const integrationUrl = url.searchParams.get('url')

        if (!integrationUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const response = await loadRemoteIntegrationHandler(integrationUrl)
        return new Response(JSON.stringify(response), {
          status: response.error ? 400 : 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
