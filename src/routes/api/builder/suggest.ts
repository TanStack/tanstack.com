import { createFileRoute } from '@tanstack/react-router'
import { suggestHandler } from '~/builder/api'

export const Route = createFileRoute('/api/builder/suggest')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()

          const response = await suggestHandler(body)
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error suggesting features:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to generate suggestions',
              details: error instanceof Error ? error.message : String(error),
            }),
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
