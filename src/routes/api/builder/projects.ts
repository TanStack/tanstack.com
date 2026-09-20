import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from '~/utils/api-boundary.server'
import {
  BuilderProjectLimitError,
  BuilderProjectNotFoundError,
  BuilderProjectConflictError,
  createBuilderProjectState,
  preflightBuilderProjectCreation,
} from '~/utils/builder-project-events.server'
import {
  getOrImportBuilderProjectState,
  listOrImportBuilderProjectStates,
  reserveLegacyBuilderProjectId,
  toBuilderProject,
} from '~/utils/builder-project-state.server'
import {
  BuilderProjectStorageUnavailableError,
} from '~/utils/builder-project-storage.server'
import { isBuilderProjectId } from '~/utils/builder-project'
import {
  BuilderProjectSnapshotQuarantinedError,
  BuilderProjectSnapshotStorageUnavailableError,
  getBuilderProjectSnapshotHash,
  parseStoredBuilderProjectSnapshot,
} from '~/utils/builder-project-snapshot-storage.server'
import {
  BuilderProjectSnapshotLimitError,
  BuilderProjectSnapshotRegistryConflictError,
  storeBuilderProjectSnapshotForOwner,
} from '~/utils/builder-project-snapshot-registry.server'
import {
  checkIpRateLimit,
  checkUserWindowRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'

const maxRequestBytes = 2 * 1024 * 1024

export const Route = createFileRoute('/api/builder/projects')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const rateLimit = await checkIpRateLimit(
          request,
          RATE_LIMITS.builderProjectList,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)

        try {
          const projects = await listOrImportBuilderProjectStates(user.userId)
          return jsonResponse(
            { projects: projects.map(toBuilderProject) },
            { headers: rateLimit.headers },
          )
        } catch (error) {
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
          console.error('Failed to list builder projects:', error)
          return jsonError(
            'Failed to list builder projects',
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
          RATE_LIMITS.builderProjectWrite,
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
          input = parseBuilderProjectRequest(body.body)
        } catch (error) {
          return jsonError(
            error instanceof Error ? error.message : 'Invalid builder project',
            400,
            rateLimit.headers,
          )
        }

        try {
          await listOrImportBuilderProjectStates(user.userId)
          const snapshotHash = await getBuilderProjectSnapshotHash(
            input.project,
          )
          const existing = await preflightBuilderProjectCreation({
            id: input.id,
            ownerId: user.userId,
            clientMutationId: input.clientMutationId,
            revisionId: input.revisionId,
            snapshotHash,
            title: input.project.title,
            description: input.project.description,
            ...(input.forkedFromId
              ? { forkedFromId: input.forkedFromId }
              : {}),
          })
          if (existing) {
            return jsonResponse(
              { project: toBuilderProject(existing) },
              { status: 201, headers: rateLimit.headers },
            )
          }
          const creationLimit = await checkUserWindowRateLimit(
            user.userId,
            RATE_LIMITS.builderProjectCreateDaily,
          )
          if (!creationLimit.allowed) {
            return rateLimitedResponse(creationLimit)
          }
          await reserveLegacyBuilderProjectId(input.id)

          if (input.forkedFromId) {
            try {
              await getOrImportBuilderProjectState(input.forkedFromId)
            } catch (error) {
              if (error instanceof BuilderProjectNotFoundError) {
                return jsonError(
                  'Fork source builder was not found',
                  400,
                  rateLimit.headers,
                )
              }
              throw error
            }
          }

          const snapshot = input.project
          const storedSnapshot = await storeBuilderProjectSnapshotForOwner(
            user.userId,
            snapshot,
          )
          const state = await createBuilderProjectState({
            id: input.id,
            revisionId: input.revisionId,
            clientMutationId: input.clientMutationId,
            description: snapshot.description,
            forkedFromId: input.forkedFromId,
            ownerId: user.userId,
            snapshotHash: storedSnapshot.hash,
            title: snapshot.title,
          })
          return jsonResponse(
            { project: toBuilderProject(state) },
            { status: 201, headers: rateLimit.headers },
          )
        } catch (error) {
          if (error instanceof BuilderProjectLimitError) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (
            error instanceof BuilderProjectSnapshotLimitError ||
            error instanceof BuilderProjectSnapshotRegistryConflictError
          ) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (error instanceof BuilderProjectConflictError) {
            return jsonError(error.message, 409, rateLimit.headers)
          }
          if (
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
          console.error('Failed to create builder project:', error)
          return jsonError(
            'Failed to create builder project',
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
        key !== 'forkedFromId' &&
        key !== 'id' &&
        key !== 'project' &&
        key !== 'revisionId',
    ) ||
    !('clientMutationId' in value) ||
    !('id' in value) ||
    !('project' in value) ||
    !('revisionId' in value) ||
    typeof value.clientMutationId !== 'string' ||
    !isBuilderProjectId(value.clientMutationId) ||
    typeof value.id !== 'string' ||
    !isBuilderProjectId(value.id) ||
    typeof value.revisionId !== 'string' ||
    !isBuilderProjectId(value.revisionId)
  ) {
    throw new Error('Invalid builder project request')
  }

  const forkedFromId =
    'forkedFromId' in value ? value.forkedFromId : undefined
  if (
    forkedFromId !== undefined &&
    (typeof forkedFromId !== 'string' || !isBuilderProjectId(forkedFromId))
  ) {
    throw new Error('Invalid fork source builder ID')
  }

  return {
    clientMutationId: value.clientMutationId,
    id: value.id,
    project: parseStoredBuilderProjectSnapshot(value.project),
    revisionId: value.revisionId,
    ...(forkedFromId ? { forkedFromId } : {}),
  }
}
