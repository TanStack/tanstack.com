import { createFileRoute } from '@tanstack/react-router'
import { normalizeFrameworkId } from '~/application-starter/frameworks'

export const Route = createFileRoute('/api/application-starter/features')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url)
          const framework = normalizeFrameworkId(
            url.searchParams.get('framework') ?? 'react',
          )
          const { getFeaturesHandler } = await import('~/application-starter/api/features')
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
