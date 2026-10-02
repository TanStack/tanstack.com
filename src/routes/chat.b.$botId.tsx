import { createFileRoute, redirect } from '@tanstack/react-router'
import { resolveChatRoute } from '~/chat/workspace.functions'
import { validateWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/b/$botId')({
  validateSearch: validateWorkspaceSearch,
  beforeLoad: async ({ params, search }) => {
    const identity = await resolveChatRoute({ data: { botId: params.botId } })
    throw redirect({
      to: '/chat/c/$conversationId',
      params: { conversationId: identity.conversationId },
      search: { ...search, conversation: undefined },
      replace: true,
    })
  },
})
