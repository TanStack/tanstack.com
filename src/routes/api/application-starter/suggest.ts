import { createFileRoute } from '@tanstack/react-router'
import {
  applicationStarterErrorResponse,
  applicationStarterInternalErrorResponse,
  applicationStarterJsonResponse,
  readApplicationStarterJsonRequest,
} from '~/application-starter/api/request-boundary.server'
import {
  applicationStarterSuggestBodySchema,
  parseApplicationStarterRequest,
} from '~/application-starter/api/request-schema.server'

export const Route = createFileRoute('/api/application-starter/suggest')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const requestBody = await readApplicationStarterJsonRequest(request)
          if ('response' in requestBody) {
            return requestBody.response
          }

          let body
          try {
            body = parseApplicationStarterRequest(applicationStarterSuggestBodySchema, requestBody.body)
          } catch {
            return applicationStarterErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { suggestHandler } = await import('~/application-starter/api/suggest')
          const response = await suggestHandler(body)
          return applicationStarterJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error suggesting features:', error)
          return applicationStarterInternalErrorResponse('Failed to generate suggestions')
        }
      },
    },
  },
})
