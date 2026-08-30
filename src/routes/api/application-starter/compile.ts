import { createFileRoute } from '@tanstack/react-router'
import {
  applicationStarterErrorResponse,
  applicationStarterInternalErrorResponse,
  applicationStarterJsonResponse,
  readApplicationStarterJsonRequest,
} from '~/application-starter/api/request-boundary.server'
import {
  applicationStarterCompileBodySchema,
  parseApplicationStarterRequest,
} from '~/application-starter/api/request-schema.server'

export const Route = createFileRoute('/api/application-starter/compile')({
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
            body = parseApplicationStarterRequest(
              applicationStarterCompileBodySchema,
              requestBody.body,
            )
          } catch {
            return applicationStarterErrorResponse(
              'Invalid request body',
              400,
              requestBody.rateLimit,
            )
          }

          const { compileHandler } = await import('~/application-starter/api/compile')
          const response = await compileHandler(body.definition, {
            format: body.format,
          })
          return applicationStarterJsonResponse(response, requestBody.rateLimit)
        } catch (error) {
          console.error('Error compiling project:', error)
          return applicationStarterInternalErrorResponse('Failed to compile project')
        }
      },
    },
  },
})
