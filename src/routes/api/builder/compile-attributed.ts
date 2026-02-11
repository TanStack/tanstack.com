import { createFileRoute } from '@tanstack/react-router'
import {
  compileWithAttributionHandler,
  type ProjectDefinition,
} from '~/builder/api'

export const Route = createFileRoute('/api/builder/compile-attributed')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { definition } = body as {
            definition: ProjectDefinition
          }

          if (!definition) {
            return new Response(
              JSON.stringify({ error: 'Missing definition in request body' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const response = await compileWithAttributionHandler(definition)

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error compiling project with attribution:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to compile project',
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
