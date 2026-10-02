import { expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { WorkspaceBot } from '../../src/chat/core/bot-workspace'
vi.mock('../../src/chat/workspace.functions', () => ({
  resolveChatRoute: vi.fn(),
}))
import { chatIdentityQuery } from '../../src/chat/components/chatIdentityQuery'
import {
  conversationRouteQuery,
  conversationRouteFreshMs,
} from '../../src/chat/components/conversationRouteQuery'
const bot: WorkspaceBot = {
  id: 'bot',
  workspace_id: 'workspace',
  parent_id: null,
  name: 'Chat',
  purpose: '',
  created_at: 0,
  mainConversationId: 'conversation',
  version: 0,
  archived_at: null,
  deleted_at: null,
  updated_at: 0,
  pinned: false,
  section_id: null,
  position: 0,
  tags: [],
}
const identity = {
  userId: 'viewer',
  workspaceId: 'workspace',
  botId: 'bot',
  conversationId: 'conversation',
}
it('uses the sidebar prefetch when opening its canonical conversation, and rechecks stale history', async () => {
  const queries = new QueryClient()
  const request = vi.fn().mockResolvedValue({ identity, messages: [] })
  const input = {
    queries,
    request,
    workspaceId: 'workspace',
    bot,
    userId: 'viewer',
  }
  const prefetched = await queries.fetchQuery(conversationRouteQuery(input))
  const opened = conversationRouteQuery({
    ...input,
    conversationId: 'conversation',
  })
  expect(await queries.fetchQuery(opened)).toBe(prefetched)
  expect(request).toHaveBeenCalledExactlyOnceWith(
    'conversations/conversation/history',
  )
  expect(
    queries.getQueryData(chatIdentityQuery('conversation').queryKey),
  ).toEqual(identity)
  queries.setQueryData(opened.queryKey, prefetched, {
    updatedAt: Date.now() - conversationRouteFreshMs - 1,
  })
  await queries.fetchQuery(opened)
  expect(request).toHaveBeenCalledTimes(2)
  queries.clear()
})
it('never seeds navigation or history from a different account’s response', async () => {
  const queries = new QueryClient()
  const request = vi.fn().mockResolvedValue({
    identity: { ...identity, userId: 'other' },
    messages: [],
  })
  await expect(
    queries.fetchQuery(
      conversationRouteQuery({
        queries,
        request,
        workspaceId: 'workspace',
        bot,
        userId: 'viewer',
      }),
    ),
  ).rejects.toThrow('account and workspace')
  expect(
    queries.getQueryData(chatIdentityQuery('conversation').queryKey),
  ).toBeUndefined()
  expect(
    queries.getQueryCache().findAll({ queryKey: ['history'] }),
  ).toHaveLength(0)
  queries.clear()
})
