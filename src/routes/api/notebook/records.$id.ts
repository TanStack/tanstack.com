import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  isNotebookRecordId,
  isNotebookRecordTimestamp,
} from '~/utils/notebook-record'
import {
  deleteStoredNotebookRecord,
  getStoredNotebookRecord,
  NotebookRecordConflictError,
  NotebookRecordOwnershipError,
  NotebookRecordQuarantinedError,
  NotebookRecordStorageUnavailableError,
  updateStoredNotebookRecord,
} from '~/utils/notebook-record-storage.server'
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

export const Route = createFileRoute('/api/notebook/records/$id')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        if (!isNotebookRecordId(params.id)) {
          return jsonError('Notebook not found', 404)
        }

        try {
          const record = await getStoredNotebookRecord(params.id)
          return record
            ? jsonResponse({ record })
            : jsonError('Notebook not found', 404)
        } catch (error) {
          if (error instanceof NotebookRecordStorageUnavailableError) {
            return jsonError('Notebook record storage is unavailable', 503)
          }
          console.error('Failed to load notebook record:', error)
          return jsonError('Failed to load notebook record', 500)
        }
      },
      PATCH: async ({
        params,
        request,
      }: {
        params: { id: string }
        request: Request
      }) => {
        const requestError = validateJsonRequest(request, {
          maxContentLength: maxRequestBytes,
        })
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }
        if (!isNotebookRecordId(params.id)) {
          return jsonError('Notebook not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.notebookRecordSave,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        let existing
        try {
          existing = await getStoredNotebookRecord(params.id)
        } catch (error) {
          if (error instanceof NotebookRecordStorageUnavailableError) {
            return jsonError(
              'Notebook record storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to load notebook record for update:', error)
          return jsonError(
            'Failed to load notebook record',
            500,
            rateLimit.headers,
          )
        }
        if (!existing) {
          return jsonError('Notebook not found', 404, rateLimit.headers)
        }
        if (existing.ownerId !== user.userId) {
          return jsonError('Not authorized', 403, rateLimit.headers)
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

        let input
        try {
          input = parseNotebookRecordProjectRequest(body.body)
        } catch (error) {
          return jsonError(
            error instanceof Error ? error.message : 'Invalid notebook project',
            400,
            rateLimit.headers,
          )
        }

        if (existing.updatedAt !== input.expectedUpdatedAt) {
          return jsonError(
            'Notebook was updated elsewhere',
            409,
            rateLimit.headers,
          )
        }

        try {
          const project = input.project
          const storedProject = await storeNotebookProject(project)
          const record = await updateStoredNotebookRecord({
            author: {
              name: user.name ?? user.displayUsername,
              image: user.image ?? user.oauthImage,
            },
            description: project.description,
            expectedUpdatedAt: input.expectedUpdatedAt,
            id: existing.id,
            ownerId: user.userId,
            projectHash: storedProject.hash,
            title: project.title,
          })
          if (!record) {
            return jsonError('Notebook not found', 404, rateLimit.headers)
          }
          return jsonResponse({ record }, { headers: rateLimit.headers })
        } catch (error) {
          if (error instanceof NotebookRecordConflictError) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (error instanceof NotebookRecordOwnershipError) {
            return jsonError('Not authorized', 403, rateLimit.headers)
          }
          if (
            error instanceof NotebookProjectQuarantinedError ||
            error instanceof NotebookRecordQuarantinedError
          ) {
            return jsonError(
              'Notebook project is unavailable',
              410,
              rateLimit.headers,
            )
          }
          if (
            error instanceof NotebookProjectStorageUnavailableError ||
            error instanceof NotebookRecordStorageUnavailableError
          ) {
            return jsonError(
              'Notebook storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to update notebook record:', error)
          return jsonError(
            'Failed to update notebook record',
            500,
            rateLimit.headers,
          )
        }
      },
      DELETE: async ({
        params,
        request,
      }: {
        params: { id: string }
        request: Request
      }) => {
        const requestError = validateSameOriginRequest(request)
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }
        if (!isNotebookRecordId(params.id)) {
          return jsonError('Notebook not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.notebookProjectWrite,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        try {
          const deleted = await deleteStoredNotebookRecord(
            params.id,
            user.userId,
          )
          return deleted
            ? jsonResponse(
                { deleted: true, id: params.id },
                { headers: rateLimit.headers },
              )
            : jsonError('Notebook not found', 404, rateLimit.headers)
        } catch (error) {
          if (error instanceof NotebookRecordOwnershipError) {
            return jsonError('Not authorized', 403, rateLimit.headers)
          }
          if (error instanceof NotebookRecordStorageUnavailableError) {
            return jsonError(
              'Notebook record storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to delete notebook record:', error)
          return jsonError(
            'Failed to delete notebook record',
            500,
            rateLimit.headers,
          )
        }
      },
    },
  },
})

function parseNotebookRecordProjectRequest(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => key !== 'project' && key !== 'expectedUpdatedAt',
    ) ||
    !('project' in value) ||
    !('expectedUpdatedAt' in value) ||
    typeof value.expectedUpdatedAt !== 'string' ||
    !isNotebookRecordTimestamp(value.expectedUpdatedAt)
  ) {
    throw new Error('Invalid notebook project request')
  }

  return {
    expectedUpdatedAt: value.expectedUpdatedAt,
    project: parseStoredNotebookProject(value.project),
  }
}
