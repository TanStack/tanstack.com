import { chatIdentityQuery } from './chatIdentityQuery'
import type { QueryClient } from '@tanstack/react-query'
import type { History } from './App'
import type { WorkspaceBot } from '../core/bot-workspace'
import {
  conversationDestination,
  conversationQueryKey,
} from '../core/conversation-destination'

// A recent authorized history read can open immediately. Older cache entries
// must be checked again before their private messages are displayed.
export const conversationRouteFreshMs = 30_000

export function conversationRouteQuery({
  queries,
  request,
  workspaceId,
  bot,
  conversationId,
  userId,
}: {
  queries: QueryClient
  request: <T>(path: string) => Promise<T>
  workspaceId?: string
  bot: WorkspaceBot
  conversationId?: string
  userId: string
}) {
  const requestedConversationId = conversationId ?? bot.mainConversationId
  return {
    queryKey: [
      'conversation-route',
      workspaceId,
      bot.id,
      requestedConversationId,
      userId,
    ] as const,
    queryFn: async () => {
      const snapshot = await request<History>(
        requestedConversationId
          ? `conversations/${encodeURIComponent(requestedConversationId)}/history`
          : `bots/${encodeURIComponent(bot.id)}/history`,
      )
      const destination = conversationDestination(
        {
          userId,
          workspaceId: bot.workspace_id,
          botId: bot.id,
          mainConversationId: bot.mainConversationId,
        },
        snapshot.identity,
        requestedConversationId,
      )
      queries.setQueryData(
        chatIdentityQuery(destination.conversationId).queryKey,
        {
          conversationId: destination.conversationId,
          botId: destination.botId,
          workspaceId: destination.workspaceId,
          userId: destination.userId,
        },
      )
      queries.setQueryData(
        conversationQueryKey(destination, 'history'),
        snapshot,
      )
      return { snapshot, destination }
    },
    staleTime: conversationRouteFreshMs,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  }
}
