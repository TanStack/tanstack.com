import { createFileRoute } from '@tanstack/react-router'
import { normalizeFrameworkId } from '~/builder/frameworks'

export const Route = createFileRoute('/api/builder/features')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          if (!__TANSTACK_ENABLE_SERVER_BUILDER_GENERATION__) {
            return new Response(
              JSON.stringify({
                error: 'Builder server generation is disabled for this deployment',
              }),
              {
                status: 501,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const url = new URL(request.url)
          const framework = normalizeFrameworkId(
            url.searchParams.get('framework') ?? 'react',
          )
          const { getFeaturesHandler } = await import('~/builder/api/features')
          const response = await getFeaturesHandler(framework)
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching features:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch features' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
