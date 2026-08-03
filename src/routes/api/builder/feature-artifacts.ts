import { createFileRoute } from '@tanstack/react-router'
import { normalizeFrameworkId } from '~/builder/frameworks'
import {
  builderErrorResponse,
  builderInternalErrorResponse,
  builderJsonResponse,
  readBuilderJsonRequest,
} from '~/builder/api/request-boundary.server'
import {
  builderFeatureArtifactsBodySchema,
  parseBuilderRequest,
} from '~/builder/api/request-schema.server'

export const Route = createFileRoute('/api/builder/feature-artifacts')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const requestBody = await readBuilderJsonRequest(request)
          if ('response' in requestBody) {
            return requestBody.response
          }

          let body
          try {
            body = parseBuilderRequest(
              builderFeatureArtifactsBodySchema,
              requestBody.body,
            )
          } catch {
            return builderErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { featureArtifactsHandler } = await import(
            '~/builder/api/feature-artifacts'
          )
          const response = await featureArtifactsHandler({
            features: body.features,
            projectName: body.projectName,
            framework: normalizeFrameworkId(body.framework),
            featureOptions: body.featureOptions,
            tailwind: body.tailwind,
          })

          return builderJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error fetching feature artifacts:', error)
          return builderInternalErrorResponse(
            'Failed to fetch feature artifacts',
          )
        }
      },
    },
  },
})
