import { useQuery } from '@tanstack/react-query'
import {
  createThreadSchema,
  type ThreadListItem,
} from '../core/conversation-threads'
import type { ConversationDestination } from '../core/conversation-destination'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'

export function threadAccessDenied(error: unknown) {
  return error instanceof ApiError && [401, 403, 404].includes(error.status)
}

export function threadRequestKey(
  userId: string,
  workspaceId: string,
  conversationId: string,
  messageId: string,
) {
  return JSON.stringify([
    'gum',
    'create-thread',
    1,
    userId,
    workspaceId,
    conversationId,
    messageId,
  ])
}

export class ThreadRequestStore {
  constructor(
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    readonly key: string,
  ) {}
  read() {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (raw.length > 2000)
      throw new Error('The thread request could not be recovered.')
    return createThreadSchema.parse(JSON.parse(raw))
  }
  create(sourceMessageId: string) {
    const previous = this.read()
    if (previous) {
      if (previous.sourceMessageId !== sourceMessageId)
        throw new Error('The thread request changed.')
      return previous
    }
    const command = createThreadSchema.parse({
      idempotencyKey: crypto.randomUUID(),
      sourceMessageId,
    })
    const raw = JSON.stringify(command)
    this.storage.setItem(this.key, raw)
    if (this.storage.getItem(this.key) !== raw)
      throw new Error(
        'TanChat could not save this request safely on this device.',
      )
    return command
  }
  clear(command: ReturnType<typeof createThreadSchema.parse>) {
    if (this.read()?.idempotencyKey !== command.idempotencyKey) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw new Error('The thread request could not be cleared.')
  }
}

export const threadQueryKey = (destination: ConversationDestination) => [
  'conversation-threads',
  destination.workspaceId,
  destination.userId,
  destination.conversationId,
]

export function useConversationThreads(
  destination: ConversationDestination,
  parentConversationId?: string,
) {
  const { request } = useWorkspaceApi()
  return useQuery({
    queryKey: threadQueryKey(
      parentConversationId
        ? { ...destination, conversationId: parentConversationId }
        : destination,
    ),
    queryFn: () =>
      request<{ items: ThreadListItem[] }>(
        `${parentConversationId ? `conversations/${encodeURIComponent(parentConversationId)}` : destination.apiPath}/threads`,
      ),
    enabled: destination.isMainConversation || !!parentConversationId,
    staleTime: 0,
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}
