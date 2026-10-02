import {
  createFileRoute,
  redirect,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { getCurrentUser } from '~/utils/auth.functions'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { validateWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    validateWorkspaceSearch(search),
  beforeLoad: async ({ search }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { returnTo: '/chat' } })
    const workspace = await loadChatWorkspace()
    throw redirect({
      to: '/chat/c/$conversationId',
      params: {
        conversationId: search.conversation ?? workspace.conversationId,
      },
      search: { ...search, conversation: undefined },
    })
  },
})
