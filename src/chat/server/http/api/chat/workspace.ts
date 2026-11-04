import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute('/api/chat/workspace', z.object({}), {
  POST: async ({ request }) => {
    const { hasChatAccess } = await import('~/chat/access.server')
    const { getAuthService } = await import('~/auth/index.server')
    const { openPersonalChatWorkspace } =
      await import('~/chat/workspace.server')
    const { jsonError, jsonResponse, validateSameOriginRequest } =
      await import('~/utils/api-boundary.server')

    const boundaryError = validateSameOriginRequest(request)
    if (boundaryError)
      return jsonError(boundaryError.message, boundaryError.status)
    const user = await getAuthService().getCurrentUser(request)
    if (!user) return jsonError('Sign in to TanStack.', 401)
    if (!(await hasChatAccess(user)))
      return jsonError('Chat access is not enabled for this account.', 403)
    const workspace = await openPersonalChatWorkspace(user.userId)
    return jsonResponse(workspace)
  },
})
