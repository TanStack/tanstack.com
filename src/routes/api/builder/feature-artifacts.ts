import { createFileRoute } from '@tanstack/react-router'
import { normalizeFrameworkId } from '~/builder/frameworks'

export const Route = createFileRoute('/api/builder/feature-artifacts')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const {
            features,
            projectName,
            framework,
            featureOptions,
            tailwind,
            customIntegrations,
          } = body

          if (!features || !Array.isArray(features)) {
            return new Response(
              JSON.stringify({ error: 'Missing features array' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const { featureArtifactsHandler } = await import(
            '~/builder/api/feature-artifacts'
          )
          const response = await featureArtifactsHandler({
            features,
            projectName,
            framework: normalizeFrameworkId(framework),
            featureOptions,
            tailwind,
            customIntegrations,
          })

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error fetching feature artifacts:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to fetch feature artifacts',
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
