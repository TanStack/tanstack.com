import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import { workflowRunApi } from './workflow-run-api'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import type { ConversationEnvironment } from './conversation-environment'
export async function handleWorkflowRun(
  request: Request,
  conversationId: string,
  id?: string,
  cancel = false,
): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method))
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
    const identity = await resolveConversationIdentity({
      conversationId,
      workspaceId: workspace.data,
      userId: user.userId,
    })
    const env = await getHostRuntimeEnv()
    if (!isNamespace(env?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    return await workflowRunApi(
      request,
      { CONVERSATIONS: env.CONVERSATIONS },
      identity,
      id,
      cancel,
    )
  } catch (error) {
    if (error instanceof ConversationIdentityError)
      return jsonError(error.message, error.status)
    throw error
  }
}

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
