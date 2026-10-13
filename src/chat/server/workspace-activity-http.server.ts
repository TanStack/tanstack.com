import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import { jsonError, jsonResponse } from '~/utils/api-boundary.server'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { workspaceActivity } from './bootstrap-workspace-data'
export async function handleWorkspaceActivity(
  request: Request,
  indexed = false,
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
    await readWorkspacePolicy(workspace.data, user.userId)
    const activity = await workspaceActivity(workspace.data, user.userId)
    return jsonResponse(
      indexed
        ? { workspaceId: workspace.data, userId: user.userId, activity }
        : activity,
    )
  } catch (error) {
    if (error instanceof WorkspacePolicyError)
      return jsonError(error.message, error.status)
    throw error
  }
}
