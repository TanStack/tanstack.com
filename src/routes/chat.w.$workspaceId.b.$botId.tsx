import { createFileRoute, redirect } from '@tanstack/react-router'
import { validateWorkspaceSearch } from '~/chat/core/navigation'

// Keep existing bookmarks, resolving their identity before redirecting.
export const Route = createFileRoute('/chat/w/$workspaceId/b/$botId')({
  validateSearch: validateWorkspaceSearch,
  beforeLoad: async ({ params, search }) => {
    const { resolveChatRoute } = await import('~/chat/workspace.functions')
    const identity = await resolveChatRoute({
      data: { ...params, conversationId: search.conversation },
    })
    throw redirect({
      to: '/chat/c/$conversationId',
      params: { conversationId: identity.conversationId },
      search: { ...search, conversation: undefined },
      replace: true,
    })
  },
})
