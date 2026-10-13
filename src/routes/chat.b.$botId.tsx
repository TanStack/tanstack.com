import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { resolveChatRoute } from '~/chat/workspace.functions'
import { validateWorkspaceSearch } from '~/chat/core/navigation'
import { chatIdentityQuery } from '~/chat/components/chatIdentityQuery'
import { WorkspaceSkeleton } from '~/chat/components/WorkspaceSkeleton'

export const Route = createFileRoute('/chat/b/$botId')({
  validateSearch: validateWorkspaceSearch,
  component: BotChatEntry,
})
function BotChatEntry() {
  const { botId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queries = useQueryClient()
  const identity = useQuery({
    queryKey: ['chat-bot-identity', botId],
    queryFn: () => resolveChatRoute({ data: { botId } }),
    staleTime: Infinity,
    retry: false,
  })
  useEffect(() => {
    if (!identity.data) return
    queries.setQueryData(
      chatIdentityQuery(identity.data.conversationId).queryKey,
      identity.data,
    )
    void navigate({
      to: '/chat/c/$conversationId',
      params: { conversationId: identity.data.conversationId },
      search: { ...search, conversation: undefined },
      replace: true,
    })
  }, [identity.data, navigate, queries, search])
  if (identity.error)
    return (
      <main className="loading" role="alert">
        {identity.error.message}
      </main>
    )
  return <WorkspaceSkeleton />
}
