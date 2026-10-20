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
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { ConversationCopies, type CopyEnvironment } from './conversation-copies'
import { BotWorkspaceError } from './workspace-error'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
function isNamespace(
  value: unknown,
): value is CopyEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleConversationCopy(
  request: Request,
  id: string,
  target: 'bot' | 'conversation' | 'operation',
  source = false,
): Promise<Response> {
  if (request.method !== (target === 'operation' || source ? 'GET' : 'POST'))
    return jsonError('Method not allowed.', 405)
  if (request.method === 'POST') {
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
    if (!isNamespace(env?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    const copies = new ConversationCopies(
      { CONVERSATIONS: env.CONVERSATIONS },
      workspace.data,
      user.userId,
    )
    if (target === 'operation')
      return jsonResponse(await copies.get(z.uuid().parse(id)))
    const identity = await resolveConversationIdentity({
      workspaceId: workspace.data,
      userId: user.userId,
      ...(target === 'bot' ? { botId: id } : { conversationId: id }),
    })
    if (source)
      return jsonResponse(
        await copies.getCopySource(
          identity.botId,
          target === 'conversation' ? identity.conversationId : undefined,
        ),
      )
    const operation = await copies.create(
      identity.botId,
      await readWorkspaceJson(request),
      target === 'conversation' ? identity.conversationId : undefined,
    )
    return jsonResponse(operation, {
      status:
        operation.status === 'copying'
          ? 202
          : operation.status === 'ready'
            ? 201
            : 200,
    })
  } catch (error) {
    if (
      error instanceof ConversationIdentityError ||
      error instanceof WorkspacePolicyError ||
      error instanceof BotWorkspaceError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the copy fields and try again.', 400)
    throw error
  }
}
