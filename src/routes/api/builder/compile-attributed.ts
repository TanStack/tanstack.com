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

export const Route = createFileRoute('/api/builder/compile-attributed')({
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

          const { compileWithAttributionHandler } = await import(
            '~/builder/api/compile'
          )
          const response = await compileWithAttributionHandler(body.definition)

          return builderJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error compiling project with attribution:', error)
          return builderInternalErrorResponse('Failed to compile project')
        }
      },
    },
  },
})
