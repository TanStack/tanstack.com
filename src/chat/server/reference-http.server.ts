import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import {
  listMessageReferences,
  ReferenceError,
  type ReferenceEnvironment,
} from './message-references'
function isBucket(value: unknown): value is ReferenceEnvironment['FILES'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'put' in value &&
    typeof value.put === 'function' &&
    'get' in value &&
    typeof value.get === 'function' &&
    'head' in value &&
    typeof value.head === 'function'
  )
}
function isNamespace(
  value: unknown,
): value is ReferenceEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleReferences(
  request: Request,
  conversationId?: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
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
    const kind = z
      .enum([
        'file',
        'conversation',
        'connection',
        'tool',
        'kody',
        'skill',
        'plugin',
        'all',
      ])
      .parse(query.get('kind'))
    const search = z
      .string()
      .max(200)
      .parse(query.get('query') ?? '')
    const botId = z
      .string()
      .min(1)
      .max(200)
      .optional()
      .parse(query.get('excludeBotId') ?? undefined)
    const scope =
      conversationId === undefined
        ? { workspaceId: workspace.data, userId: user.userId, botId }
        : await resolveConversationIdentity({
            workspaceId: workspace.data,
            userId: user.userId,
            conversationId,
          })
    const host = await getHostRuntimeEnv(),
      origin = host?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (
      typeof origin !== 'string' ||
      !origin ||
      !isBucket(host?.FILES) ||
      !isNamespace(host?.CONVERSATIONS)
    )
      return jsonError('References are not configured.', 503)
    const env = {
      ...(await getMcpEnvironment()),
      KODY_ORIGIN: origin,
      FILES: host.FILES,
      CONVERSATIONS: host.CONVERSATIONS,
    }
    return jsonResponse(
      await listMessageReferences(env, scope, {
        kind,
        query: search,
        policy,
        fixture: false,
      }),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof ConversationIdentityError ||
      error instanceof McpEnvironmentError ||
      error instanceof ReferenceError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError) return jsonError('Invalid request.', 400)
    throw error
  }
}
