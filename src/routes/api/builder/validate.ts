import { createFileRoute } from '@tanstack/react-router'
import { validateHandler } from '~/builder/api'

export const Route = createFileRoute('/api/builder/validate')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { definition } = body

          if (!definition) {
            return new Response(
              JSON.stringify({ error: 'Missing definition in request body' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const response = await validateHandler(definition)
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error validating project:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to validate project',
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
