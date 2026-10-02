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
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { SavedActions } from './saved-actions'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
export async function handleSavedActions(
  request: Request,
  actionId?: string,
): Promise<Response> {
  if (!(actionId ? ['DELETE'] : ['POST']).includes(request.method))
    return jsonError('Method not allowed.', 405)
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
    const actions = new SavedActions(workspace.data, user.userId)
    return jsonResponse(
      actionId
        ? await actions.delete(actionId)
        : await actions.create(await readWorkspaceJson(request)),
    )
  } catch (error) {
    if (
      error instanceof WorkspacePolicyError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the saved action and try again.', 400)
    throw error
  }
}
