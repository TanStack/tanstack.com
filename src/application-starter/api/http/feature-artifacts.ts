import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'
import { normalizeFrameworkId } from '~/application-starter/frameworks'
import {
  applicationStarterErrorResponse,
  applicationStarterInternalErrorResponse,
  applicationStarterJsonResponse,
  readApplicationStarterJsonRequest,
} from '~/application-starter/api/request-boundary.server'
import {
  applicationStarterFeatureArtifactsBodySchema,
  parseApplicationStarterRequest,
} from '~/application-starter/api/request-schema.server'

export default defineHttpRoute(
  '/api/application-starter/feature-artifacts',
  z.object({}),
  {
    POST: async ({ request }: { request: Request }) => {
      try {
        const requestBody = await readApplicationStarterJsonRequest(request)
        if ('response' in requestBody) {
          return requestBody.response
        }

        let body
        try {
          body = parseApplicationStarterRequest(
            applicationStarterFeatureArtifactsBodySchema,
            requestBody.body,
          )
        } catch {
          return applicationStarterErrorResponse(
            'Invalid request body',
            400,
            requestBody.rateLimit,
          )
        }

        const { featureArtifactsHandler } =
          await import('~/application-starter/api/feature-artifacts')
        const response = await featureArtifactsHandler({
          features: body.features,
          projectName: body.projectName,
          framework: normalizeFrameworkId(body.framework),
          featureOptions: body.featureOptions,
          tailwind: body.tailwind,
        })

        return applicationStarterJsonResponse(response, requestBody.rateLimit)
      } catch (error) {
        console.error('Error fetching feature artifacts:', error)
        return applicationStarterInternalErrorResponse(
          'Failed to fetch feature artifacts',
        )
      }
    },
  },
)
