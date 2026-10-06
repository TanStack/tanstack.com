import { hasChatAccess } from '../access.server'
import { z } from 'zod'
import { getAuthService } from '~/auth/index.server'
import {
  jsonError,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import { composerDraftApi } from './composer-drafts'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'

export async function handleComposerDraft(
  request: Request,
  accountId: string,
  scope: string,
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
  if (accountId !== user.userId)
    return jsonError('Sign in to the original account to sync this draft.', 403)
  try {
    return await composerDraftApi(
      request,
      user.userId,
      scope,
      request.method === 'POST' ? await readWorkspaceJson(request) : undefined,
    )
  } catch (error) {
    if (error instanceof WorkspaceBodyError)
      return jsonError(error.message, error.status)
    if (error instanceof z.ZodError)
      return jsonError('Check the draft and try again.', 400)
    throw error
  }
}
