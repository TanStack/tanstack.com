import { hasChatAccess } from '~/chat/access.server'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { openPersonalChatWorkspace } from '~/chat/workspace.server'
import { jsonError, jsonResponse, validateSameOriginRequest } from '~/utils/api-boundary.server'

export const Route = createFileRoute('/api/chat/workspace')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const boundaryError = validateSameOriginRequest(request)
        if (boundaryError) return jsonError(boundaryError.message, boundaryError.status)
        const user = await getAuthService().getCurrentUser(request)
        if (!user) return jsonError('Sign in to TanStack.', 401)
        if (!await hasChatAccess(user))
          return jsonError('Chat access is not enabled for this account.', 403)
        const workspace = await openPersonalChatWorkspace(user.userId)
        return jsonResponse(workspace)
      },
    },
  },
})
