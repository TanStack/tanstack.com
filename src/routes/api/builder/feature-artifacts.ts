import { createFileRoute } from '@tanstack/react-router'
import { featureArtifactsHandler } from '~/builder/api'

export const Route = createFileRoute('/api/builder/feature-artifacts')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { features, projectName, framework, featureOptions, tailwind, customIntegrations } = body as {
            features: Array<string>
            projectName?: string
            framework?: 'react-cra' | 'solid'
            featureOptions?: Record<string, Record<string, unknown>>
            tailwind?: boolean
            customIntegrations?: Array<unknown>
          }

          if (!features || !Array.isArray(features)) {
            return new Response(
              JSON.stringify({ error: 'Missing features array' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const response = await featureArtifactsHandler({
            features,
            projectName,
            framework,
            featureOptions,
            tailwind,
            customIntegrations: customIntegrations as Parameters<typeof featureArtifactsHandler>[0]['customIntegrations'],
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
