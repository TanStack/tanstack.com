import { z } from 'zod'
import type { WorkspaceSearch } from './navigation'

const identitySchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  botId: z.string().min(1),
  conversationId: z.string().min(1).max(1000).optional(),
})
export type ConversationOwner = Pick<
  z.infer<typeof identitySchema>,
  'userId' | 'workspaceId' | 'botId'
> & { mainConversationId?: string }
export type ConversationResource = { botId: string; conversationId?: string }

export const conversationResourcePath = (source: ConversationResource) =>
  source.conversationId
    ? `conversations/${encodeURIComponent(source.conversationId)}`
    : `bots/${encodeURIComponent(source.botId)}`

/** A historical bot-only reference never inherits a current room's identity. */
export function sameConversationResource(
  a: ConversationResource,
  b: ConversationResource,
) {
  return a.botId === b.botId && a.conversationId === b.conversationId
}

export function conversationFilePath(
  source: ConversationResource,
  id?: string,
) {
  return `${conversationResourcePath(source)}/files${id ? '/' + encodeURIComponent(id) : ''}`
}

export function savedFileQueryKey(
  workspaceId: string | undefined,
  userId: string,
  source: ConversationResource,
  fileId?: string,
) {
  const base = [
    fileId ? 'saved-file' : 'saved-files',
    workspaceId,
    userId,
    conversationResourcePath(source),
  ]
  return fileId ? [...base, fileId] : base
}

/** Resolved by an authorized history response, never inferred from a bot ID. */
export type ConversationDestination = ReturnType<typeof conversationDestination>

export function conversationDestination(
  owner: ConversationOwner,
  identity: unknown,
  expectedConversationId?: string,
) {
  const supplied =
    identity === undefined ? undefined : identitySchema.parse(identity)
  if (
    supplied &&
    (supplied.userId !== owner.userId ||
      supplied.workspaceId !== owner.workspaceId ||
      supplied.botId !== owner.botId)
  )
    throw new Error(
      'This conversation does not match the requested account and workspace.',
    )
  const conversationId = supplied?.conversationId
  if (expectedConversationId && conversationId !== expectedConversationId)
    throw new Error(
      'This conversation does not match the requested destination.',
    )
  if (!conversationId)
    throw new Error(
      'The conversation identity is unavailable. Reload before composing.',
    )
  const isMainConversation = conversationId === owner.mainConversationId
  const storageOwner = {
    userId: owner.userId,
    workspaceId: owner.workspaceId,
    botId: owner.botId,
  }
  const legacyPath = `bots/${encodeURIComponent(owner.botId)}`
  return {
    ...owner,
    conversationId,
    isMainConversation,
    sessionKey: JSON.stringify([
      owner.userId,
      owner.workspaceId,
      conversationId ? 'conversation' : 'legacy-bot',
      conversationId ?? owner.botId,
    ]),
    apiPath: conversationResourcePath({ ...owner, conversationId }),
    // Only the declared main shares old browser keys and Web Locks. Never move
    // uncertain sends or expose those aliases to a sibling conversation.
    compatibility: {
      resourcePath: isMainConversation
        ? legacyPath
        : conversationResourcePath({ ...owner, conversationId }),
      draftScope: isMainConversation
        ? `${owner.userId}:${owner.workspaceId}:${owner.botId}`
        : JSON.stringify([
            'conversation',
            owner.userId,
            owner.workspaceId,
            conversationId,
          ]),
      sendScope: isMainConversation
        ? storageOwner
        : { ...storageOwner, conversationId },
    },
  }
}

/** Conversation links do not depend on their workspace or current bot. */
export function conversationLocation(
  destination: ConversationResource & { workspaceId: string },
  search: WorkspaceSearch,
) {
  const { conversation: _conversation, message, ...rest } = search
  if (destination.conversationId) {
    return message
      ? {
          to: '/chat/c/$conversationId/m/$messageId' as const,
          params: {
            conversationId: destination.conversationId,
            messageId: message,
          },
          search: rest,
        }
      : {
          to: '/chat/c/$conversationId' as const,
          params: { conversationId: destination.conversationId },
          search: rest,
        }
  }
  return {
    to: '/chat/b/$botId' as const,
    params: { botId: destination.botId },
    search: { ...rest, message },
  }
}

export const conversationQueryKey = (
  destination: ConversationDestination,
  operation: 'history' | 'archive',
) =>
  [
    operation,
    destination.workspaceId,
    destination.userId,
    destination.conversationId ? 'conversation' : 'legacy-bot',
    destination.conversationId ?? destination.botId,
  ] as const

/** Selecting a conversation leaves the currently selected message behind. */
export function selectedConversationLocation(
  destination: ConversationResource & { workspaceId: string },
  search: WorkspaceSearch,
) {
  return conversationLocation(destination, { ...search, message: undefined })
}
