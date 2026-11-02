import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'
import {
  applicationStarterErrorResponse,
  applicationStarterInternalErrorResponse,
  applicationStarterJsonResponse,
  readApplicationStarterJsonRequest,
} from '~/application-starter/api/request-boundary.server'
import {
  applicationStarterValidateBodySchema,
  parseApplicationStarterRequest,
} from '~/application-starter/api/request-schema.server'

export default defineHttpRoute(
  '/api/application-starter/validate',
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
            applicationStarterValidateBodySchema,
            requestBody.body,
          )
        } catch {
          return applicationStarterErrorResponse(
            'Invalid request body',
            400,
            requestBody.rateLimit,
          )
        }

        const { validateHandler } =
          await import('~/application-starter/api/validate')
        const response = await validateHandler(body.definition)
        return applicationStarterJsonResponse(response, requestBody.rateLimit)
      } catch (error) {
        console.error('Error validating project:', error)
        return applicationStarterInternalErrorResponse(
          'Failed to validate project',
        )
      }
    },
  },
)
