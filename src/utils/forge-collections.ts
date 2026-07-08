import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'
import {
  deleteForgeChatShell,
  getForgeChatShells,
  type ForgeChatShell,
} from '~/utils/forge.functions'
import type { ForgeStateEvent } from '~/utils/forge-state'

export const forgeChatShellsQueryKey = ['forge', 'chat-shells'] as const

export interface ForgeProjectedStateEvent extends ForgeStateEvent {
  chatId: string
  id: string
  stateOffset: number
  timelineOffset: number
}

export function createForgeChatShellsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      getKey: (chat) => chat.id,
      queryClient,
      queryFn: async (): Promise<Array<ForgeChatShell>> => {
        try {
          return (await getForgeChatShells()).chats
        } catch (error) {
          console.error('Forge chat list could not load.', error)

          return (
            queryClient.getQueryData<Array<ForgeChatShell>>(
              forgeChatShellsQueryKey,
            ) ?? []
          )
        }
      },
      queryKey: forgeChatShellsQueryKey,
      onDelete: async ({ collection, transaction }) => {
        const deletedChatIds = transaction.mutations.map(
          (mutation) => mutation.key,
        )
        let result: Awaited<ReturnType<typeof deleteForgeChatShell>> | undefined

        for (const chatId of deletedChatIds) {
          result = await deleteForgeChatShell({
            data: { chatId },
          })
        }

        if (result) {
          const serverChatIds = new Set(result.chats.map((chat) => chat.id))
          const staleChatIds = Array.from(collection.state.keys()).filter(
            (chatId) => !serverChatIds.has(chatId),
          )

          collection.utils.writeBatch(() => {
            collection.utils.writeDelete([
              ...new Set([...deletedChatIds, ...staleChatIds]),
            ])
            collection.utils.writeUpsert(result.chats)
          })
        }

        return { refetch: false }
      },
      staleTime: 10_000,
    }),
  )
}

export function createForgeProjectedStateEventsCollection(chatId: string) {
  return createCollection(
    localOnlyCollectionOptions<ForgeProjectedStateEvent, string>({
      getKey: (event) => event.id,
      id: `forge-projected-state-events-${chatId}`,
      initialData: [],
    }),
  )
}

export function insertForgeProjectedStateEvents(
  collection: ReturnType<typeof createForgeProjectedStateEventsCollection>,
  chatId: string,
  events: Array<ForgeStateEvent>,
) {
  for (const event of events) {
    const row = toForgeProjectedStateEvent(chatId, event)

    if (!collection.has(row.id)) {
      collection.insert(row)
    }
  }
}

function toForgeProjectedStateEvent(
  chatId: string,
  event: ForgeStateEvent,
): ForgeProjectedStateEvent {
  const stateOffset = Number(event.headers.stateOffset)
  const timelineOffset = Number(event.headers.timelineOffset)

  return {
    ...event,
    chatId,
    id: [
      chatId,
      Number.isFinite(stateOffset) ? stateOffset : event.headers.stateOffset,
      event.type,
      event.key,
    ].join(':'),
    stateOffset: Number.isFinite(stateOffset) ? stateOffset : 0,
    timelineOffset: Number.isFinite(timelineOffset) ? timelineOffset : 0,
  }
}
