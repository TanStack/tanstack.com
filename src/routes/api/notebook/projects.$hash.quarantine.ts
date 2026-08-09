import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { purgeHostingCacheTags } from '~/utils/hosting-cache.server'
import {
  getNotebookProjectCacheTag,
  isNotebookProjectHash,
  NotebookProjectStorageUnavailableError,
  quarantineNotebookProject,
} from '~/utils/notebook-project-storage.server'

export const Route = createFileRoute(
  '/api/notebook/projects/$hash/quarantine',
)({
  server: {
    handlers: {
      POST: async ({
        params,
        request,
      }: {
        params: { hash: string }
        request: Request
      }) => {
        const requestError = validateSameOriginRequest(request)
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }
        if (!isNotebookProjectHash(params.hash)) {
          return jsonError('Notebook project not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) {
          return jsonError('Not authenticated', 401)
        }
        if (!user.capabilities.includes('admin')) {
          return jsonError('Not authorized', 403)
        }

        try {
          await quarantineNotebookProject(params.hash, user.userId)
          const purge = await purgeHostingCacheTags([
            getNotebookProjectCacheTag(params.hash),
          ])
          return jsonResponse({ purge, quarantined: true })
        } catch (error) {
          if (error instanceof NotebookProjectStorageUnavailableError) {
            return jsonError('Notebook project storage is unavailable', 503)
          }
          console.error('Failed to quarantine notebook project:', error)
          return jsonError('Failed to quarantine notebook project', 500)
        }
      },
    },
  },
})
