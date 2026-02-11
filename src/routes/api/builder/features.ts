import { createFileRoute } from '@tanstack/react-router'
import { getFeaturesHandler, type FrameworkId } from '~/builder/api'

export const Route = createFileRoute('/api/builder/features')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url)
          const framework = (url.searchParams.get('framework') ?? 'react-cra') as FrameworkId
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
