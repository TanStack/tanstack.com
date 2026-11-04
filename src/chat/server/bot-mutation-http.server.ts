import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { applyConversationBulkAction } from './conversation-bulk-actions'
import { BotWorkspace } from './bot-workspace'
import type { WorkspaceLifecycleEnvironment } from './workspace-lifecycle-reservation'
import { BotWorkspaceError } from './workspace-error'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
import { workspaceIndexResponse } from './workspace-index-response'
import type { WorkspaceSync } from './workspace-sync-object'
type SyncNamespace = {
  getByName(id: string): Pick<WorkspaceSync, 'publish' | 'snapshot'>
}
function isSyncNamespace(value: unknown): value is SyncNamespace {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
function isConversationNamespace(
  value: unknown,
): value is WorkspaceLifecycleEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleBotMutation(
  request: Request,
  botId?: string,
  operation?: string,
  collectionOperation?: 'bulk' | 'move' | 'history',
): Promise<Response> {
  if (
    !(
      botId
        ? operation === 'organization' || !operation
          ? ['PATCH']
          : ['POST']
        : ['POST']
    ).includes(request.method)
  )
    return jsonError('Method not allowed.', 405)
  if (
    operation &&
    !['organization', 'move', 'delete', 'restore'].includes(operation)
  )
    return jsonError('Not found.', 404)
  const origin = validateSameOriginRequest(request)
  if (origin) return jsonError(origin.message, origin.status)
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
    await readWorkspacePolicy(workspace.data, user.userId)
    const env = await getHostRuntimeEnv()
    if (
      !isSyncNamespace(env?.WORKSPACE_SYNC) ||
      !isConversationNamespace(env?.CONVERSATIONS)
    )
      return jsonError('Workspace sync is unavailable.', 503)
    const bots = new BotWorkspace(
      { WORKSPACE_SYNC: env.WORKSPACE_SYNC, CONVERSATIONS: env.CONVERSATIONS },
      workspace.data,
      user.userId,
    )
    const body = await readWorkspaceJson(request)
    const result =
      collectionOperation === 'history'
        ? await bots.applyHistory(body)
        : collectionOperation === 'bulk'
          ? await applyConversationBulkAction(bots, body)
          : collectionOperation === 'move'
            ? await bots.moveGroup(body)
            : !botId
              ? await bots.create(body)
              : operation === 'organization'
                ? await bots.organize(botId, body)
                : operation === 'move'
                  ? await bots.move(botId, body)
                  : operation === 'delete'
                    ? await bots.delete(botId, body)
                    : operation === 'restore'
                      ? await bots.restore(botId, body)
                      : await bots.patch(botId, body)
    if (!botId && !collectionOperation) return jsonResponse(result)
    return workspaceIndexResponse(
      result,
      workspace.data,
      user.userId,
      env.WORKSPACE_SYNC.getByName(workspace.data),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof BotWorkspaceError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the conversation and try again.', 400)
    throw error
  }
}
