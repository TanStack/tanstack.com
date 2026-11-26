import { hasChatAccess } from '../access.server'
import { executionProjectSnapshotApi } from './execution-project-snapshots'
import type { FileEnvironment } from './saved-files'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import { executionSessionCommandSchema } from '../core/execution-sessions'
import { executionEventReadSchema } from '../core/execution-events'
import { ExecutionSessionError } from './execution-sessions'
import { browserExecutionRequestAllowed } from './browser-execution'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
import type { ConversationEnvironment } from './conversation-environment'
function isNamespace(
  value: unknown,
): value is ConversationEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleConversationExecution(
  request: Request,
  conversationId: string,
  snapshotId?: string,
): Promise<Response> {
  if (!(snapshotId ? ['GET', 'PUT'] : ['GET', 'POST']).includes(request.method))
    return jsonError('Method not allowed.', 405)
  if (request.method !== 'GET') {
    const origin = validateSameOriginRequest(request)
    if (origin) return jsonError(origin.message, origin.status)
  }
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  const query = new URL(request.url).searchParams
  const workspace = z
    .string()
    .min(1)
    .max(1000)
    .safeParse(query.get('workspaceId'))
  if (!workspace.success || query.getAll('workspaceId').length !== 1)
    return jsonError('Choose a workspace.', 400)
  try {
    const identity = await resolveConversationIdentity({
      conversationId,
      workspaceId: workspace.data,
      userId: user.userId,
    })
    const env = await getHostRuntimeEnv()
    if (!env || !isNamespace(env.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    if (
      !browserExecutionRequestAllowed(request, {
        APP_MODE: typeof env.APP_MODE === 'string' ? env.APP_MODE : undefined,
        GUM_DEV_EXECUTION:
          typeof env.GUM_DEV_EXECUTION === 'string'
            ? env.GUM_DEV_EXECUTION
            : undefined,
      })
    )
      return jsonError('Execution is not available.', 404)
    if (snapshotId) {
      if (!isFiles(env.FILES))
        return jsonError('File storage is unavailable.', 503)
      return await executionProjectSnapshotApi(
        request,
        { FILES: env.FILES },
        identity,
        env.CONVERSATIONS.getByName(identity.conversationId),
        snapshotId,
      )
    }
    const command =
      request.method === 'POST'
        ? executionSessionCommandSchema.parse(await readWorkspaceJson(request))
        : undefined
    const stub = env.CONVERSATIONS.getByName(identity.conversationId)
    // The DO repeats authorization and checks its immutable identity. No bot
    // alias, body identity or browser runtime report can supply this scope.
    const query = new URL(request.url).searchParams
    query.delete('workspaceId')
    if (request.method === 'GET' && query.size > 0) {
      if (query.size === 1 && query.get('history') === '1') {
        const result = await stub.executionHistory(identity)
        return result.ok
          ? jsonResponse(result.history)
          : jsonError(result.error, result.status)
      }
      if (query.size === 1 && query.has('sessionId')) {
        const sessionId = z.uuid().safeParse(query.get('sessionId'))
        if (!sessionId.success)
          return jsonError('Invalid execution session identity.', 400)
        const result = await stub.executionSnapshot(identity, sessionId.data)
        return result.ok
          ? jsonResponse(result.snapshot)
          : jsonError(result.error, result.status)
      }
      if (
        query.size !== 2 ||
        query.getAll('sessionId').length !== 1 ||
        query.getAll('after').length !== 1
      )
        return jsonError('Invalid execution output cursor.', 400)
      const after = query.get('after')!
      const read = executionEventReadSchema.parse({
        sessionId: query.get('sessionId'),
        after: /^(0|[1-9]\d*)$/.test(after) ? Number(after) : NaN,
      })
      const result = await stub.executionEvents(identity, read)
      return result.ok
        ? jsonResponse(result.page)
        : jsonError(result.error, result.status)
    }
    const result = command
      ? await stub.changeExecution(identity, command)
      : await stub.executionSnapshot(identity)
    return result.ok
      ? jsonResponse(result.snapshot)
      : jsonError(result.error, result.status)
  } catch (error) {
    if (
      error instanceof ConversationIdentityError ||
      error instanceof ExecutionSessionError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the execution request and try again.', 400)
    throw error
  }
}

function isFiles(value: unknown): value is FileEnvironment['FILES'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    typeof value.get === 'function' &&
    'put' in value &&
    typeof value.put === 'function' &&
    'head' in value &&
    typeof value.head === 'function'
  )
}
