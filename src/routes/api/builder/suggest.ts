import { createFileRoute } from '@tanstack/react-router'
import {
  builderErrorResponse,
  builderInternalErrorResponse,
  builderJsonResponse,
  readBuilderJsonRequest,
} from '~/builder/api/request-boundary.server'
import {
  builderSuggestBodySchema,
  parseBuilderRequest,
} from '~/builder/api/request-schema.server'

export const Route = createFileRoute('/api/builder/suggest')({
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
            body = parseBuilderRequest(builderSuggestBodySchema, requestBody.body)
          } catch {
            return builderErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { suggestHandler } = await import('~/builder/api/suggest')
          const response = await suggestHandler(body)
          return builderJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error suggesting features:', error)
          return builderInternalErrorResponse('Failed to generate suggestions')
        }
      },
    },
  },
})
