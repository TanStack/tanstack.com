import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  readAccountPreferences,
  updateAccountPreferences,
  AccountPreferencesError,
} from './account-preferences'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'

export async function handleAccountPreferences(
  request: Request,
): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method))
    return jsonError('Method not allowed.', 405)
  if (request.method === 'POST') {
    const error = validateSameOriginRequest(request)
    if (error) return jsonError(error.message, error.status)
  }
  const user = await getAuthService().getCurrentUser(request)
  if (!user) return jsonError('Sign in to continue.', 401)
  if (!(await hasChatAccess(user)))
    return jsonError('Chat access is unavailable.', 403)
  try {
    if (request.method === 'GET')
      return jsonResponse(await readAccountPreferences(user.userId))
    return jsonResponse(
      await updateAccountPreferences(
        user.userId,
        await readWorkspaceJson(request),
      ),
    )
  } catch (error) {
    if (
      error instanceof AccountPreferencesError ||
      error instanceof WorkspaceBodyError
    )
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the form fields and try again.', 400)
    throw error
  }
}
