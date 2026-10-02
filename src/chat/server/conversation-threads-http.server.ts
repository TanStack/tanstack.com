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
import {
  ConversationThreads,
  ConversationThreadError,
  type ThreadEnvironment,
} from './conversation-threads'
import { ConversationIdentityError } from '../conversation-identity.server'
import { threadCommandSchema } from '../core/conversation-threads'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
function isThreadNamespace(
  value: unknown,
): value is ThreadEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleConversationThreads(
  request: Request,
  conversationId: string,
  operation: string,
): Promise<Response> {
  if (!['threads', 'thread'].includes(operation))
    return jsonError('Not found.', 404)
  if (
    !(
      operation === 'threads' ? ['GET', 'POST'] : ['GET', 'POST', 'DELETE']
    ).includes(request.method)
  )
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
    await readWorkspacePolicy(workspace.data, user.userId)
    const env = await getHostRuntimeEnv()
    if (!isThreadNamespace(env?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    const threads = new ConversationThreads(
      { CONVERSATIONS: env.CONVERSATIONS },
      workspace.data,
      user.userId,
    )
    if (request.method === 'GET')
      return jsonResponse(
        operation === 'threads'
          ? await threads.list(conversationId)
          : await threads.get(conversationId),
      )
    if (request.method === 'DELETE') {
      const thread = await threads.get(conversationId)
      return jsonResponse(
        await threads.archive(
          conversationId,
          { type: 'archive', expectedVersion: thread.version, archived: true },
          true,
        ),
      )
    }
    if (operation === 'threads')
      return jsonResponse(
        await threads.create(conversationId, await readWorkspaceJson(request)),
      )
    const command = threadCommandSchema.parse(await readWorkspaceJson(request))
    return jsonResponse(
      command.type === 'archive'
        ? await threads.archive(conversationId, command)
        : await threads.rename(conversationId, command),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof ConversationThreadError ||
      error instanceof ConversationIdentityError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the thread and try again.', 400)
    throw error
  }
}
