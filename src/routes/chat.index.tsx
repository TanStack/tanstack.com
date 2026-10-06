import {
  createFileRoute,
  useNavigate,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { validateWorkspaceSearch } from '~/chat/core/navigation'
import { chatIdentityQuery } from '~/chat/components/chatIdentityQuery'
import { WorkspaceSkeleton } from '~/chat/components/WorkspaceSkeleton'

export const Route = createFileRoute('/chat/')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    validateWorkspaceSearch(search),
  component: ChatEntry,
})
function ChatEntry() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queries = useQueryClient()
  const workspace = useQuery({
    queryKey: ['personal-chat-workspace'],
    queryFn: () => loadChatWorkspace(),
    staleTime: Infinity,
    retry: false,
  })
  useEffect(() => {
    if (!workspace.data) return
    const data = workspace.data
    queries.setQueryData(chatIdentityQuery(data.conversationId).queryKey, {
      conversationId: data.conversationId,
      botId: data.assistantId,
      workspaceId: data.workspace.id,
      userId: data.workspace.ownerId,
    })
    void navigate({
      to: '/chat/c/$conversationId',
      params: { conversationId: search.conversation ?? data.conversationId },
      search: { ...search, conversation: undefined },
      replace: true,
    })
  }, [workspace.data, queries, navigate, search])
  if (workspace.error)
    return (
      <main className="loading" role="alert">
        {workspace.error.message}
      </main>
    )
  return <WorkspaceSkeleton />
}
