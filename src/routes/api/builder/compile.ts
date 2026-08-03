import { createFileRoute } from '@tanstack/react-router'
import {
  builderErrorResponse,
  builderInternalErrorResponse,
  builderJsonResponse,
  readBuilderJsonRequest,
} from '~/builder/api/request-boundary.server'
import {
  builderCompileBodySchema,
  parseBuilderRequest,
} from '~/builder/api/request-schema.server'

export const Route = createFileRoute('/api/builder/compile')({
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
              builderCompileBodySchema,
              requestBody.body,
            )
          } catch {
            return builderErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { compileHandler } = await import('~/builder/api/compile')
          const response = await compileHandler(body.definition, {
            format: body.format,
          })
          return builderJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error compiling project:', error)
          return builderInternalErrorResponse('Failed to compile project')
        }
      },
    },
  },
})
