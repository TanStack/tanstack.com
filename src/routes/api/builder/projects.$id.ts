import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import { isBuilderProjectId } from '~/utils/builder-project'
import {
  BuilderProjectConflictError,
  BuilderProjectDeletedError,
  BuilderProjectNotFoundError,
  BuilderProjectOwnershipError,
  deleteBuilderProjectState,
  getBuilderProjectMutationRequestHash,
  updateBuilderProjectState,
} from '~/utils/builder-project-events.server'
import {
  getOrImportBuilderProjectState,
  toBuilderProject,
} from '~/utils/builder-project-state.server'
import { BuilderProjectStorageUnavailableError } from '~/utils/builder-project-storage.server'
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

export const Route = createFileRoute('/api/builder/projects/$id')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        if (!isBuilderProjectId(params.id)) {
          return jsonError('Project not found', 404)
        }

        try {
          const project = await getOrImportBuilderProjectState(params.id)
          return jsonResponse({ project: toBuilderProject(project) })
        } catch (error) {
          if (error instanceof BuilderProjectNotFoundError) {
            return jsonError('Project not found', 404)
          }
          if (error instanceof BuilderProjectSnapshotQuarantinedError) {
            return jsonError('Builder project is unavailable', 410)
          }
          if (
            error instanceof BuilderProjectSnapshotLimitError ||
            error instanceof BuilderProjectSnapshotRegistryConflictError
          ) {
            return jsonError(error.message, 409)
          }
          if (
            error instanceof BuilderProjectSnapshotStorageUnavailableError
          ) {
            return jsonError('Builder project storage is unavailable', 503)
          }
          if (error instanceof BuilderProjectStorageUnavailableError) {
            return jsonError('Builder project storage is unavailable', 503)
          }
          console.error('Failed to load builder project:', error)
          return jsonError('Failed to load builder project', 500)
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
        if (!isBuilderProjectId(params.id)) {
          return jsonError('Project not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.builderProjectSave,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        let existing
        try {
          existing = await getOrImportBuilderProjectState(params.id)
        } catch (error) {
          if (error instanceof BuilderProjectNotFoundError) {
            return jsonError('Project not found', 404, rateLimit.headers)
          }
          if (error instanceof BuilderProjectSnapshotQuarantinedError) {
            return jsonError(
              'Builder project is unavailable',
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
          if (
            error instanceof BuilderProjectSnapshotStorageUnavailableError
          ) {
            return jsonError(
              'Builder project storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          if (error instanceof BuilderProjectStorageUnavailableError) {
            return jsonError(
              'Builder project storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to load builder project for update:', error)
          return jsonError(
            'Failed to load builder project',
            500,
            rateLimit.headers,
          )
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
          input = parseBuilderProjectRequest(body.body)
        } catch (error) {
          return jsonError(
            error instanceof Error ? error.message : 'Invalid builder project',
            400,
            rateLimit.headers,
          )
        }

        try {
          const snapshot = input.project
          const requestHash = await getBuilderProjectMutationRequestHash({
            type: 'project.revise',
            ...input,
          })
          const storedSnapshot = await storeBuilderProjectSnapshotForOwner(
            user.userId,
            snapshot,
          )
          const project = await updateBuilderProjectState({
            clientMutationId: input.clientMutationId,
            requestHash,
            description: snapshot.description,
            expectedRevisionNumber: input.expectedRevisionNumber,
            projectId: existing.id,
            revisionId: input.revisionId,
            ownerId: user.userId,
            snapshotHash: storedSnapshot.hash,
            title: snapshot.title,
          })
          return jsonResponse(
            { project: toBuilderProject(project) },
            { headers: rateLimit.headers },
          )
        } catch (error) {
          if (
            error instanceof BuilderProjectSnapshotLimitError ||
            error instanceof BuilderProjectSnapshotRegistryConflictError
          ) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (error instanceof BuilderProjectConflictError) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (error instanceof BuilderProjectOwnershipError) {
            return jsonError('Not authorized', 403, rateLimit.headers)
          }
          if (
            error instanceof BuilderProjectDeletedError ||
            error instanceof BuilderProjectSnapshotQuarantinedError
          ) {
            return jsonError(
              'Builder project is unavailable',
              410,
              rateLimit.headers,
            )
          }
          if (
            error instanceof BuilderProjectStorageUnavailableError ||
            error instanceof BuilderProjectSnapshotStorageUnavailableError
          ) {
            return jsonError(
              'Builder storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to update builder project:', error)
          return jsonError(
            'Failed to update builder project',
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
        const requestError = validateJsonRequest(request, {
          maxContentLength: 1_024,
        })
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }
        if (!isBuilderProjectId(params.id)) {
          return jsonError('Project not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.builderProjectWrite,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        const body = await readJsonBody(request, { maxContentLength: 1_024 })
        if (!body.success) {
          return jsonError(
            body.error.message,
            body.error.status,
            rateLimit.headers,
          )
        }
        let clientMutationId
        try {
          clientMutationId = parseDeleteBuilderProjectRequest(body.body)
        } catch {
          return jsonError(
            'Invalid Builder project delete request',
            400,
            rateLimit.headers,
          )
        }

        try {
          await getOrImportBuilderProjectState(params.id)
          await deleteBuilderProjectState({
            projectId: params.id,
            ownerId: user.userId,
            clientMutationId,
          })
          return jsonResponse(
            { deleted: true, id: params.id },
            { headers: rateLimit.headers },
          )
        } catch (error) {
          if (error instanceof BuilderProjectNotFoundError) {
            return jsonError('Project not found', 404, rateLimit.headers)
          }
          if (error instanceof BuilderProjectSnapshotQuarantinedError) {
            return jsonError(
              'Builder project is unavailable',
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
          if (error instanceof BuilderProjectOwnershipError) {
            return jsonError('Not authorized', 403, rateLimit.headers)
          }
          if (
            error instanceof BuilderProjectStorageUnavailableError ||
            error instanceof BuilderProjectSnapshotStorageUnavailableError
          ) {
            return jsonError(
              'Builder project storage is unavailable',
              503,
              rateLimit.headers,
            )
          }
          console.error('Failed to delete builder project:', error)
          return jsonError(
            'Failed to delete builder project',
            500,
            rateLimit.headers,
          )
        }
      },
    },
  },
})

function parseBuilderProjectRequest(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        key !== 'clientMutationId' &&
        key !== 'expectedRevisionNumber' &&
        key !== 'project' &&
        key !== 'revisionId',
    ) ||
    !('clientMutationId' in value) ||
    !('expectedRevisionNumber' in value) ||
    !('project' in value) ||
    !('revisionId' in value) ||
    typeof value.clientMutationId !== 'string' ||
    !isBuilderProjectId(value.clientMutationId) ||
    typeof value.expectedRevisionNumber !== 'number' ||
    !Number.isSafeInteger(value.expectedRevisionNumber) ||
    value.expectedRevisionNumber < 1 ||
    typeof value.revisionId !== 'string' ||
    !isBuilderProjectId(value.revisionId)
  ) {
    throw new Error('Invalid builder project request')
  }

  return {
    clientMutationId: value.clientMutationId,
    expectedRevisionNumber: value.expectedRevisionNumber,
    project: parseStoredBuilderProjectSnapshot(value.project),
    revisionId: value.revisionId,
  }
}

function parseDeleteBuilderProjectRequest(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== 'clientMutationId') ||
    !('clientMutationId' in value) ||
    typeof value.clientMutationId !== 'string' ||
    !isBuilderProjectId(value.clientMutationId)
  ) {
    throw new Error('Invalid Builder project delete request')
  }
  return value.clientMutationId
}
