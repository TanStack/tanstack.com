import { createFileRoute } from '@tanstack/react-router'
import {
  builderErrorResponse,
  builderInternalErrorResponse,
  builderJsonResponse,
  readBuilderJsonRequest,
} from '~/builder/api/request-boundary.server'
import {
  builderValidateBodySchema,
  parseBuilderRequest,
} from '~/builder/api/request-schema.server'

export const Route = createFileRoute('/api/builder/validate')({
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
              builderValidateBodySchema,
              requestBody.body,
            )
          } catch {
            return builderErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { validateHandler } = await import('~/builder/api/validate')
          const response = await validateHandler(body.definition)
          return builderJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error validating project:', error)
          return builderInternalErrorResponse('Failed to validate project')
        }
      },
    },
  },
})
