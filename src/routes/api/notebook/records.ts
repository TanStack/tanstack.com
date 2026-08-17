import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import {
  assertNotebookRecordCapacity,
  createStoredNotebookRecord,
  getStoredNotebookRecord,
  listStoredNotebookRecords,
  NotebookRecordLimitError,
  NotebookRecordQuarantinedError,
  NotebookRecordStorageUnavailableError,
} from '~/utils/notebook-record-storage.server'
import { isNotebookRecordId } from '~/utils/notebook-record'
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

export const Route = createFileRoute('/api/notebook/records')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.notebookRecordList,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        try {
          const records = await listStoredNotebookRecords(user.userId)
          return jsonResponse({ records }, { headers: rateLimit.headers })
        } catch (error) {
          if (error instanceof NotebookRecordStorageUnavailableError) {
            return jsonError(
              'Notebook record storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to list notebook records:', error)
          return jsonError(
            'Failed to list notebook records',
            500,
            rateLimit.headers,
          )
        }
      },
      POST: async ({ request }: { request: Request }) => {
        const requestError = validateJsonRequest(request, {
          maxContentLength: maxRequestBytes,
        })
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.notebookProjectWrite,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

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

        try {
          await assertNotebookRecordCapacity(user.userId)

          if (
            input.forkedFromId &&
            !(await getStoredNotebookRecord(input.forkedFromId))
          ) {
            return jsonError(
              'Fork source notebook was not found',
              400,
              rateLimit.headers,
            )
          }

          const project = input.project
          const storedProject = await storeNotebookProject(project)
          const record = await createStoredNotebookRecord({
            author: {
              name: user.name ?? user.displayUsername,
              image: user.image ?? user.oauthImage,
            },
            description: project.description,
            forkedFromId: input.forkedFromId,
            ownerId: user.userId,
            projectHash: storedProject.hash,
            title: project.title,
          })
          return jsonResponse(
            { record },
            { status: 201, headers: rateLimit.headers },
          )
        } catch (error) {
          if (error instanceof NotebookRecordLimitError) {
            return jsonError(error.message, 409, rateLimit.headers)
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
          console.error('Failed to create notebook record:', error)
          return jsonError(
            'Failed to create notebook record',
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
      (key) => key !== 'project' && key !== 'forkedFromId',
    ) ||
    !('project' in value)
  ) {
    throw new Error('Invalid notebook project request')
  }

  const forkedFromId =
    'forkedFromId' in value ? value.forkedFromId : undefined
  if (
    forkedFromId !== undefined &&
    (typeof forkedFromId !== 'string' || !isNotebookRecordId(forkedFromId))
  ) {
    throw new Error('Invalid fork source notebook ID')
  }

  return {
    project: parseStoredNotebookProject(value.project),
    ...(forkedFromId ? { forkedFromId } : {}),
  }
}
