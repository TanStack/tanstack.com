import { createFileRoute } from '@tanstack/react-router'
import { env } from '~/utils/env'

// Proxy to Convex HTTP endpoint
export const Route = createFileRoute('/api/github/releases')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const convexSiteUrl = env.VITE_CONVEX_SITE_URL
        if (!convexSiteUrl) {
          return new Response(
            JSON.stringify({ error: 'Convex site URL not configured' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        // Forward to Convex HTTP endpoint
        const url = `${convexSiteUrl}/github/releases`
        const headers = new Headers(request.headers)
        headers.set('accept-encoding', 'application/json')

        return fetch(url, {
          method: 'POST',
          headers,
          body: request.body,
          // @ts-expect-error - duplex is required for streaming request bodies
          duplex: 'half',
        })
      },
    },
  },
})

