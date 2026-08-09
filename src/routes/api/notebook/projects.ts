import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import {
  NotebookProjectQuarantinedError,
  NotebookProjectStorageUnavailableError,
  parseStoredNotebookProject,
  storeNotebookProject,
} from '~/utils/notebook-project-storage.server'
import {
  checkIpRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'

const maxRequestBytes = 2 * 1024 * 1024

export const Route = createFileRoute('/api/notebook/projects')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const requestError = validateJsonRequest(request, {
          maxContentLength: maxRequestBytes,
        })
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.notebookProjectWrite,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) {
          return jsonError('Not authenticated', 401, rateLimit.headers)
        }

        const body = await readJsonBody(request, {
          maxContentLength: maxRequestBytes,
        })
        if (!body.success) {
          return jsonError(
            body.error.message,
            body.error.status,
            rateLimit.headers,
          )
        }

        let project
        try {
          project = parseStoredNotebookProject(body.body)
        } catch (error) {
          return jsonError(
            error instanceof Error ? error.message : 'Invalid notebook project',
            400,
            rateLimit.headers,
          )
        }

        try {
          const result = await storeNotebookProject(project)
          return jsonResponse(
            {
              hash: result.hash,
              url: `/notebook/p/${result.hash}`,
              sourceUrl: `/api/notebook/projects/${result.hash}`,
            },
            {
              status: result.created ? 201 : 200,
              headers: rateLimit.headers,
            },
          )
        } catch (error) {
          if (error instanceof NotebookProjectQuarantinedError) {
            return jsonError(
              'Notebook project is unavailable',
              410,
              rateLimit.headers,
            )
          }
          if (error instanceof NotebookProjectStorageUnavailableError) {
            return jsonError(
              'Notebook project storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to store notebook project:', error)
          return jsonError(
            'Failed to store notebook project',
            500,
            rateLimit.headers,
          )
        }
      },
    },
  },
})
