import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { resolveChatRoute } from '../workspace.functions'
import type { WorkspaceBot } from '../core/bot-workspace'

export function chatIdentityQuery(conversationId: string) {
  return queryOptions({
    queryKey: ['chat-identity', conversationId],
    queryFn: () => resolveChatRoute({ data: { conversationId } }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function rememberChatIdentity(
  queries: QueryClient,
  bot: WorkspaceBot,
  userId: string,
) {
  if (!bot.mainConversationId) return
  const identity = {
    conversationId: bot.mainConversationId,
    botId: bot.id,
    workspaceId: bot.workspace_id,
    userId,
  }
  queries.setQueryData(
    chatIdentityQuery(identity.conversationId).queryKey,
    identity,
  )
  return identity
}
