import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { App } from '~/chat/components/App'
import { resolveChatRoute } from '~/chat/workspace.functions'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/c/$conversationId')({
  validateSearch: validateWorkspaceSearch,
  search: { middlewares: [stripSearchParams(defaultWorkspaceSearch)] },
  beforeLoad: async ({ params }) => ({
    chatIdentity: await resolveChatRoute({
      data: { conversationId: params.conversationId },
    }),
  }),
  component: App,
})
