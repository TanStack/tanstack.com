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
import { BotDrafts, BotDraftError } from './bot-drafts'
import { startBotDraft, type DraftStartEnvironment } from './bot-draft-start'
import { SavedActions } from './saved-actions'
import { getModelEnvironment } from './model-environment.server'
import {
  getMcpEnvironment,
  McpEnvironmentError,
} from './mcp-environment.server'
import { SavedFileError, type FileEnvironment } from './saved-files'
import { RunModelError } from './run-models'
import { ModelAttachmentError } from './model-attachments'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
function isFileBucket(value: unknown): value is FileEnvironment['FILES'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'put' in value &&
    typeof value.put === 'function' &&
    'head' in value &&
    typeof value.head === 'function' &&
    'get' in value &&
    typeof value.get === 'function'
  )
}
function isConversationNamespace(
  value: unknown,
): value is DraftStartEnvironment['CONVERSATIONS'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getByName' in value &&
    typeof value.getByName === 'function'
  )
}
export async function handleBotDraft(
  request: Request,
  id: string,
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
  const url = new URL(request.url)
  const workspace = z
    .string()
    .min(1)
    .max(1000)
    .safeParse(url.searchParams.get('workspaceId'))
  if (!workspace.success || url.searchParams.getAll('workspaceId').length !== 1)
    return jsonError('Choose a workspace.', 400)
  try {
    const policy = await readWorkspacePolicy(workspace.data, user.userId)
    const host = await getHostRuntimeEnv()
    if (!isFileBucket(host?.FILES))
      return jsonError('File storage is unavailable.', 503)
    if (request.method === 'GET')
      return jsonResponse(
        await new BotDrafts(
          { FILES: host.FILES },
          workspace.data,
          user.userId,
        ).get(id),
      )
    if (!isConversationNamespace(host?.CONVERSATIONS))
      return jsonError('Conversation storage is unavailable.', 503)
    const origin = host.KODY_ORIGIN ?? process.env.KODY_ORIGIN
    if (typeof origin !== 'string' || !origin)
      return jsonError('Integrations are not configured.', 503)
    const env = {
      ...(await getMcpEnvironment()),
      ...(await getModelEnvironment()),
      KODY_ORIGIN: origin,
      FILES: host.FILES,
      CONVERSATIONS: host.CONVERSATIONS,
    }
    return jsonResponse(
      await startBotDraft(
        env,
        workspace.data,
        user.userId,
        id,
        await readWorkspaceJson(request),
        {
          policy,
          recipes: await new SavedActions(workspace.data, user.userId).list(
            true,
          ),
          fixture: false,
          appOrigin: url.origin,
        },
      ),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof BotDraftError ||
      error instanceof SavedFileError ||
      error instanceof RunModelError ||
      error instanceof ModelAttachmentError ||
      error instanceof McpEnvironmentError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the first message and try again.', 400)
    throw error
  }
}
