import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  updateWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
export async function handleWorkspacePolicy(
  request: Request,
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
    return jsonResponse(
      await updateWorkspacePolicy(
        workspace.data,
        user.userId,
        await readWorkspaceJson(request),
      ),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the policy fields and try again.', 400)
    throw error
  }
}
