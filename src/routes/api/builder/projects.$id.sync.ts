import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  BuilderProjectConflictError,
  BuilderProjectDeletedError,
  BuilderProjectLeaseError,
  BuilderProjectNotFoundError,
  BuilderProjectOwnershipError,
  BuilderProjectRevisionConflictError,
  cancelPendingBuilderProjectRun,
  claimBuilderProjectRun,
  createBuilderProjectThread,
  enqueueBuilderProjectRun,
  finishBuilderProjectRun,
  getBuilderProjectMutationRequestHash,
  getBuilderProjectConversationSnapshotPage,
  getBuilderProjectState,
  heartbeatBuilderProjectRun,
  importBuilderProjectTranscript,
  interruptExpiredBuilderProjectRuns,
  listBuilderProjectEvents,
  updateBuilderProjectState,
} from '~/utils/builder-project-events.server'
import { isBuilderProjectId } from '~/utils/builder-project'
import { getOrImportBuilderProjectState } from '~/utils/builder-project-state.server'
import {
  createBuilderProjectEventStreamResponse,
  isBuilderProjectSyncStreamRequest,
  parseBuilderProjectSyncCursor,
} from '~/utils/builder-project-sync-http.server'
import {
  encodeBuilderProjectSyncSnapshotContinuation,
  parseBuilderProjectSyncSnapshotContinuation,
  parseBuilderProjectSyncSnapshotPage,
  parseBuilderProjectSyncRequest,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncCommandOutcome,
} from '~/utils/builder-project-sync'
import {
  BuilderProjectSnapshotQuarantinedError,
  BuilderProjectSnapshotStorageUnavailableError,
} from '~/utils/builder-project-snapshot-storage.server'
import {
  BuilderProjectSnapshotLimitError,
  BuilderProjectSnapshotRegistryConflictError,
  storeBuilderProjectSnapshotForOwner,
} from '~/utils/builder-project-snapshot-registry.server'
import { BuilderProjectStorageUnavailableError } from '~/utils/builder-project-storage.server'
import {
  checkIpRateLimit,
  checkUserRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'

const maxRequestBytes = 2 * 1024 * 1024

export const Route = createFileRoute('/api/builder/projects/$id/sync')({
  server: {
    handlers: {
      GET: async ({
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
        if (!isBuilderProjectId(params.id)) {
          return jsonError('Project not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Not authenticated', 401)

        const streamRequest = isBuilderProjectSyncStreamRequest(request)
        const continuationValues = streamRequest
          ? []
          : new URL(request.url).searchParams.getAll('continuation')
        let continuation
        try {
          if (continuationValues.length > 1) throw new Error()
          const value = continuationValues[0]
          continuation = value
            ? parseBuilderProjectSyncSnapshotContinuation(value)
            : undefined
          if (continuation && continuation.projectId !== params.id) {
            throw new Error()
          }
        } catch {
          return jsonError('Invalid Builder project sync continuation', 400)
        }
        const rateLimitConfig = continuation
          ? RATE_LIMITS.builderProjectSyncSnapshotPage
          : RATE_LIMITS.builderProjectSyncStream
        const ipRateLimitConfig = continuation
          ? RATE_LIMITS.builderProjectSyncSnapshotPageIp
          : RATE_LIMITS.builderProjectSyncStreamIp
        const rateLimit = await checkUserRateLimit(
          `${user.userId}:${params.id}`,
          rateLimitConfig,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)
        const ipBackstop = await checkIpRateLimit(request, ipRateLimitConfig)
        if (!ipBackstop.allowed) return rateLimitedResponse(ipBackstop)

        try {
          if (streamRequest) {
            let cursor
            try {
              cursor = parseBuilderProjectSyncCursor(request)
            } catch {
              return jsonError(
                'Invalid Builder project sync cursor',
                400,
                rateLimit.headers,
              )
            }
            let project
            try {
              project = await getBuilderProjectState({
                projectId: params.id,
                ownerId: user.userId,
                includeDeleted: true,
              })
            } catch (error) {
              if (!(error instanceof BuilderProjectNotFoundError)) throw error
              await getOrImportBuilderProjectState(params.id)
              project = await getBuilderProjectState({
                projectId: params.id,
                ownerId: user.userId,
                includeDeleted: true,
              })
            }
            if (cursor > project.lastEventSequence) {
              return jsonError(
                'Builder project sync cursor is ahead of the project',
                400,
                rateLimit.headers,
              )
            }

            return createBuilderProjectEventStreamResponse({
              cursor,
              signal: request.signal,
              headers: rateLimit.headers,
              listEvents: (afterSequence) =>
                listBuilderProjectEvents({
                  projectId: params.id,
                  ownerId: user.userId,
                  afterSequence,
                  limit: 25,
                }),
              interruptExpiredRuns: async () => {
                await interruptExpiredBuilderProjectRuns({
                  projectId: params.id,
                  ownerId: user.userId,
                  includeDeleted: true,
                })
              },
            })
          }

          if (!continuation) await getOrImportBuilderProjectState(params.id)
          const snapshot = await getBuilderProjectConversationSnapshotPage({
            projectId: params.id,
            ownerId: user.userId,
            ...(continuation ? { continuation } : {}),
          })
          const page = parseBuilderProjectSyncSnapshotPage({
            project: snapshot.project,
            cursor: snapshot.cursor,
            headCursor: snapshot.headCursor,
            threads: snapshot.threads,
            messages: snapshot.messages,
            runs: snapshot.runs,
            continuation: snapshot.continuation
              ? encodeBuilderProjectSyncSnapshotContinuation(
                  snapshot.continuation,
                )
              : null,
          })
          return jsonResponse(page, { headers: rateLimit.headers })
        } catch (error) {
          return builderProjectSyncErrorResponse(error, rateLimit.headers)
        }
      },
      POST: async ({
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

        const rateLimit = await checkUserRateLimit(
          `${user.userId}:${params.id}`,
          RATE_LIMITS.builderProjectSyncCommand,
        )
        if (!rateLimit.allowed) return rateLimitedResponse(rateLimit)
        const ipBackstop = await checkIpRateLimit(
          request,
          RATE_LIMITS.builderProjectSyncCommandIp,
        )
        if (!ipBackstop.allowed) return rateLimitedResponse(ipBackstop)

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
          input = parseBuilderProjectSyncRequest(body.body)
        } catch {
          return jsonError(
            'Invalid Builder project sync request',
            400,
            rateLimit.headers,
          )
        }

        try {
          await getOrImportBuilderProjectState(params.id)
          await getBuilderProjectState({
            projectId: params.id,
            ownerId: user.userId,
          })
          const results: Array<BuilderProjectSyncCommandOutcome> = []
          for (const command of input.commands) {
            try {
              results.push(
                await applyBuilderProjectSyncCommand({
                  projectId: params.id,
                  ownerId: user.userId,
                  command,
                }),
              )
            } catch (error) {
              if (error instanceof BuilderProjectLeaseError) {
                results.push({
                  clientMutationId: command.clientMutationId,
                  rejected: true,
                  code: 'run-lease-invalid',
                  message: error.message,
                })
                continue
              }
              if (
                command.type === 'project.revise' &&
                error instanceof BuilderProjectConflictError
              ) {
                results.push({
                  clientMutationId: command.clientMutationId,
                  rejected: true,
                  code: 'project-revision-conflict',
                  message: error.message,
                })
                continue
              }
              if (
                command.type === 'run.finish' &&
                command.revision !== undefined &&
                error instanceof BuilderProjectRevisionConflictError
              ) {
                results.push({
                  clientMutationId: command.clientMutationId,
                  rejected: true,
                  code: 'project-revision-conflict',
                  message: error.message,
                  ...(error.sequence === undefined
                    ? {}
                    : { sequence: error.sequence }),
                })
                continue
              }
              throw error
            }
          }
          return jsonResponse(
            {
              cursor: Math.max(
                0,
                ...results.map((result) => result.sequence ?? 0),
              ),
              results,
            },
            { headers: rateLimit.headers },
          )
        } catch (error) {
          return builderProjectSyncErrorResponse(error, rateLimit.headers)
        }
      },
    },
  },
})

async function applyBuilderProjectSyncCommand({
  projectId,
  ownerId,
  command,
}: {
  projectId: string
  ownerId: string
  command: BuilderProjectSyncCommand
}) {
  const requestHash = await getBuilderProjectMutationRequestHash(command)
  switch (command.type) {
    case 'project.revise': {
      const snapshot = await storeBuilderProjectSnapshotForOwner(
        ownerId,
        command.project,
      )
      const project = await updateBuilderProjectState({
        projectId,
        ownerId,
        clientMutationId: command.clientMutationId,
        requestHash,
        revisionId: command.revisionId,
        snapshotHash: snapshot.hash,
        title: command.project.title,
        description: command.project.description,
        expectedRevisionNumber: command.expectedRevisionNumber,
      })
      return {
        clientMutationId: command.clientMutationId,
        sequence: project.lastEventSequence,
        events: [],
      }
    }
    case 'thread.create':
      return createBuilderProjectThread({
        projectId,
        ownerId,
        id: command.thread.id,
        clientMutationId: command.clientMutationId,
        requestHash,
        title: command.thread.title,
        ...(command.thread.createdAt
          ? { createdAt: new Date(command.thread.createdAt) }
          : {}),
      })
    case 'run.enqueue':
      return enqueueBuilderProjectRun({
        projectId,
        ownerId,
        runId: command.run.id,
        threadId: command.run.threadId,
        clientMutationId: command.clientMutationId,
        requestHash,
        queueKind: command.run.queueKind,
        provider: command.run.provider,
        model: command.run.model,
        userMessage: {
          id: command.userMessage.id,
          clientMutationId: command.userMessage.clientMutationId,
          content: command.userMessage.content,
          parts: command.userMessage.parts,
        },
      })
    case 'run.claim':
      return claimBuilderProjectRun({
        projectId,
        ownerId,
        runId: command.runId,
        clientMutationId: command.clientMutationId,
        requestHash,
        leaseOwnerId: command.leaseOwnerId,
      })
    case 'run.cancel':
      return cancelPendingBuilderProjectRun({
        projectId,
        ownerId,
        runId: command.runId,
        clientMutationId: command.clientMutationId,
        requestHash,
        browserSessionId: command.browserSessionId,
      })
    case 'run.heartbeat':
      return heartbeatBuilderProjectRun({
        projectId,
        ownerId,
        runId: command.runId,
        clientMutationId: command.clientMutationId,
        leaseOwnerId: command.leaseOwnerId,
        fencingToken: command.leaseFencingToken,
      })
    case 'run.finish':
      const finishResult = await finishBuilderProjectRun({
        projectId,
        ownerId,
        runId: command.runId,
        clientMutationId: command.clientMutationId,
        requestHash,
        status: command.status,
        leaseOwnerId: command.leaseOwnerId,
        fencingToken: command.leaseFencingToken,
        ...(command.revision ? { revision: command.revision } : {}),
        ...(command.error ? { error: command.error } : {}),
        ...(command.activity ? { activity: command.activity } : {}),
        ...(command.revision && command.assistantMessage
          ? {
              revisionConflictFallback: {
                clientMutationId:
                  command.assistantMessage.clientMutationId,
                error: {
                  message:
                    'The project changed before the assistant edit could be saved.',
                },
              },
            }
          : {}),
        ...(command.assistantMessage
          ? {
              assistantMessage: {
                id: command.assistantMessage.id,
                clientMutationId:
                  command.assistantMessage.clientMutationId,
                content: command.assistantMessage.content,
                parts: command.assistantMessage.parts,
                ...(command.assistantMessage.createdAt
                  ? {
                      createdAt: new Date(
                        command.assistantMessage.createdAt,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      })
      if (finishResult.revisionConflict) {
        throw new BuilderProjectRevisionConflictError(
          undefined,
          finishResult.sequence,
        )
      }
      return {
        clientMutationId: finishResult.clientMutationId,
        sequence: finishResult.sequence,
        events: finishResult.events,
        ...(finishResult.leaseFencingToken === undefined
          ? {}
          : { leaseFencingToken: finishResult.leaseFencingToken }),
      }
    case 'transcript.import':
      return importBuilderProjectTranscript({
        projectId,
        ownerId,
        clientMutationId: command.clientMutationId,
        requestHash,
        threads: command.threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          ...(thread.archivedAt
            ? { archivedAt: new Date(thread.archivedAt) }
            : {}),
        })),
        messages: command.messages.map((message) => ({
          id: message.id,
          threadId: message.threadId,
          ...(message.runId ? { runId: message.runId } : {}),
          role: message.role,
          content: message.content,
          parts: message.parts,
          position: message.position,
          createdAt: new Date(message.createdAt),
          updatedAt: new Date(message.updatedAt),
        })),
        runs: command.runs.map((run) => ({
          id: run.id,
          threadId: run.threadId,
          status: run.status,
          provider: run.provider,
          model: run.model,
          ...(run.error ? { error: run.error } : {}),
          ...(run.activity ? { activity: run.activity } : {}),
          ...(run.startedAt ? { startedAt: new Date(run.startedAt) } : {}),
          completedAt: new Date(run.completedAt),
        })),
      })
  }
}

function builderProjectSyncErrorResponse(
  error: unknown,
  headers: HeadersInit,
) {
  if (error instanceof BuilderProjectNotFoundError) {
    return jsonError('Project not found', 404, headers)
  }
  if (error instanceof BuilderProjectOwnershipError) {
    return jsonError('Not authorized', 403, headers)
  }
  if (error instanceof BuilderProjectSnapshotRegistryConflictError) {
    return jsonError(
      'Project snapshot must be uploaded before completing the run',
      409,
      headers,
    )
  }
  if (error instanceof BuilderProjectSnapshotQuarantinedError) {
    return jsonError('Builder project is unavailable', 410, headers)
  }
  if (error instanceof BuilderProjectSnapshotLimitError) {
    return jsonError(error.message, 409, headers)
  }
  if (error instanceof BuilderProjectSnapshotStorageUnavailableError) {
    return jsonError(
      'Builder project snapshot storage is unavailable',
      503,
      headers,
    )
  }
  if (error instanceof BuilderProjectStorageUnavailableError) {
    return jsonError('Builder project storage is unavailable', 503, headers)
  }
  if (
    error instanceof BuilderProjectConflictError ||
    error instanceof BuilderProjectDeletedError ||
    error instanceof BuilderProjectLeaseError
  ) {
    return jsonError(error.message, 409, headers)
  }
  console.error('Builder project sync failed:', error)
  return jsonError('Failed to sync Builder project', 500, headers)
}
