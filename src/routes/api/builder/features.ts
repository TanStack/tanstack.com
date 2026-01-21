import { createFileRoute } from '@tanstack/react-router'
import { getFeaturesHandler } from '~/builder/api'

export const Route = createFileRoute('/api/builder/features')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async () => {
        try {
          const response = await getFeaturesHandler()
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
