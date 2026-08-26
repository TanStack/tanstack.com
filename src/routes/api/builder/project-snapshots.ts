import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import {
  BuilderProjectSnapshotQuarantinedError,
  BuilderProjectSnapshotStorageUnavailableError,
  parseStoredBuilderProjectSnapshot,
} from '~/utils/builder-project-snapshot-storage.server'
import {
  BuilderProjectSnapshotLimitError,
  BuilderProjectSnapshotRegistryConflictError,
  storeBuilderProjectSnapshotForOwner,
} from '~/utils/builder-project-snapshot-registry.server'
import {
  checkIpRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'

const maxRequestBytes = 2 * 1024 * 1024

export const Route = createFileRoute('/api/builder/project-snapshots')({
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
          RATE_LIMITS.builderProjectWrite,
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
          project = parseStoredBuilderProjectSnapshot(body.body)
        } catch (error) {
          return jsonError(
            error instanceof Error ? error.message : 'Invalid project snapshot',
            400,
            rateLimit.headers,
          )
        }

        try {
          const result = await storeBuilderProjectSnapshotForOwner(
            user.userId,
            project,
          )
          return jsonResponse(
            {
              hash: result.hash,
              url: `/builder/p/${result.hash}`,
              sourceUrl: `/api/builder/project-snapshots/${result.hash}`,
            },
            {
              status: result.created ? 201 : 200,
              headers: rateLimit.headers,
            },
          )
        } catch (error) {
          if (error instanceof BuilderProjectSnapshotQuarantinedError) {
            return jsonError(
              'Project snapshot is unavailable',
              410,
              rateLimit.headers,
            )
          }
          if (
            error instanceof BuilderProjectSnapshotLimitError ||
            error instanceof BuilderProjectSnapshotRegistryConflictError
          ) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (error instanceof BuilderProjectSnapshotStorageUnavailableError) {
            return jsonError(
              'Project snapshot storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to store Builder project snapshot:', error)
          return jsonError(
            'Failed to store project snapshot',
            500,
            rateLimit.headers,
          )
        }
      },
    },
  },
})
