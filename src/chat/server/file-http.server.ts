import { hasChatAccess } from '../access.server'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
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
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import { fileApi } from './file-api'
import { SavedFileError, SavedFiles, type FileEnvironment } from './saved-files'
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
export async function handleFiles(
  request: Request,
  kind: 'bots' | 'conversations' | 'bot-drafts',
  ownerId: string,
  fileId?: string,
  content = false,
): Promise<Response> {
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
    const scope =
      kind === 'bot-drafts'
        ? { workspaceId: workspace.data, userId: user.userId, draftId: ownerId }
        : await resolveConversationIdentity({
            workspaceId: workspace.data,
            userId: user.userId,
            ...(kind === 'bots'
              ? { botId: ownerId }
              : { conversationId: ownerId }),
          })
    const env = await getHostRuntimeEnv()
    if (!isFileBucket(env?.FILES))
      return jsonError('File storage is unavailable.', 503)
    return await fileApi(request, { FILES: env.FILES }, scope, fileId, content)
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof ConversationIdentityError ||
      error instanceof SavedFileError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the file and try again.', 400)
    throw error
  }
}

export async function handleFileImport(
  request: Request,
  conversationId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
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
    const target = await resolveConversationIdentity({
      workspaceId: workspace.data,
      userId: user.userId,
      conversationId,
    })
    const input = z
      .object({
        sourceConversationId: z.string().min(1).max(1000),
        sourceFileId: z.uuid(),
        targetFileId: z.uuid(),
        expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(await readWorkspaceJson(request))
    const env = await getHostRuntimeEnv()
    if (!isFileBucket(env?.FILES))
      return jsonError('File storage is unavailable.', 503)
    return jsonResponse(
      await new SavedFiles({ FILES: env.FILES }, target).importFrom(
        input.sourceConversationId,
        input.sourceFileId,
        input.targetFileId,
        input.expectedSha256,
        { signal: request.signal },
      ),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof ConversationIdentityError ||
      error instanceof SavedFileError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the file and try again.', 400)
    throw error
  }
}
