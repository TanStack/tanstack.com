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
import {
  ConversationRetries,
  type RetryEnvironment,
} from './conversation-retries'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { BotWorkspaceError } from './workspace-error'
import { SavedFileError, type FileEnvironment } from './saved-files'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
function isNamespace(
  value: unknown,
): value is RetryEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
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
export async function handleConversationRetry(
  request: Request,
  id: string,
  operation: 'create' | 'get' | 'prepare',
): Promise<Response> {
  if (request.method !== (operation === 'get' ? 'GET' : 'POST'))
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
    const policy = await readWorkspacePolicy(workspace.data, user.userId)
    const host = await getHostRuntimeEnv()
    if (!isNamespace(host?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    if (!isFiles(host.FILES))
      return jsonError('File storage is unavailable.', 503)
    const origin = host.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (typeof origin !== 'string' || !origin)
      return jsonError('Integrations are not configured.', 503)
    const env = {
      ...(await getMcpEnvironment()),
      KODY_ORIGIN: origin,
      FILES: host.FILES,
      CONVERSATIONS: host.CONVERSATIONS,
    }
    const retries = new ConversationRetries(env, workspace.data, user.userId)
    const context = { policy, fixture: false }
    const attempt =
      operation === 'create'
        ? await retries.create(
            await resolveConversationIdentity({
              workspaceId: workspace.data,
              userId: user.userId,
              conversationId: id,
            }),
            await readWorkspaceJson(request),
            context,
          )
        : operation === 'prepare'
          ? await retries.prepare(z.uuid().parse(id), context)
          : await retries.get(z.uuid().parse(id))
    return jsonResponse(attempt, {
      status: attempt.status === 'preparing' ? 202 : 200,
    })
  } catch (error) {
    if (
      error instanceof ConversationIdentityError ||
      error instanceof WorkspacePolicyError ||
      error instanceof BotWorkspaceError ||
      error instanceof SavedFileError ||
      error instanceof McpEnvironmentError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the retry fields and try again.', 400)
    throw error
  }
}
