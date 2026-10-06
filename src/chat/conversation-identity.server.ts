import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import {
  chatBots,
  chatConversations,
  chatConversationMains,
  chatConversationThreads,
  chatMemberships,
} from '~/db/schema'

const identityInput = z
  .object({
    userId: z.string().uuid(),
    workspaceId: z.string().min(1).max(1000).optional(),
    botId: z.string().min(1).max(1000).optional(),
    conversationId: z.string().min(1).max(1000).optional(),
  })
  .refine((input) => Boolean(input.botId || input.conversationId))

export class ConversationIdentityError extends Error {
  readonly status = 404
  constructor() {
    super('Conversation not found.')
  }
}

/** Membership and ownership authorize access, never a caller-supplied ID alone. */
export async function resolveConversationAccess(
  input: z.infer<typeof identityInput>,
) {
  const parsed = identityInput.safeParse(input)
  if (!parsed.success) throw new ConversationIdentityError()
  const value = parsed.data
  const conditions = [
    eq(chatMemberships.userId, value.userId),
    eq(chatConversations.userId, value.userId),
  ]
  if (value.workspaceId)
    conditions.push(eq(chatBots.workspaceId, value.workspaceId))
  if (value.botId) conditions.push(eq(chatConversations.botId, value.botId))
  if (value.conversationId)
    conditions.push(eq(chatConversations.id, value.conversationId))
  else
    conditions.push(
      eq(chatConversationMains.conversationId, chatConversations.id),
    )
  const rows = await db
    .select({
      conversationId: chatConversations.id,
      botId: chatConversations.botId,
      userId: chatConversations.userId,
      workspaceId: chatBots.workspaceId,
      botArchivedAt: chatBots.archivedAt,
      botDeletedAt: chatBots.deletedAt,
      threadId: chatConversationThreads.conversationId,
      threadArchivedAt: chatConversationThreads.archivedAt,
    })
    .from(chatConversations)
    .innerJoin(chatBots, eq(chatBots.id, chatConversations.botId))
    .innerJoin(
      chatMemberships,
      eq(chatMemberships.workspaceId, chatBots.workspaceId),
    )
    .leftJoin(
      chatConversationMains,
      and(
        eq(chatConversationMains.botId, chatConversations.botId),
        eq(chatConversationMains.userId, chatConversations.userId),
      ),
    )
    .leftJoin(
      chatConversationThreads,
      eq(chatConversationThreads.conversationId, chatConversations.id),
    )
    .where(and(...conditions))
    .limit(2)
  if (rows.length !== 1) throw new ConversationIdentityError()
  const row = rows[0]
  return {
    identity: {
      conversationId: row.conversationId,
      botId: row.botId,
      userId: row.userId,
      workspaceId: row.workspaceId,
    },
    lifecycle: {
      bot: {
        archived_at: row.botArchivedAt?.getTime() ?? null,
        deleted_at: row.botDeletedAt?.getTime() ?? null,
      },
      thread: row.threadId
        ? { archived_at: row.threadArchivedAt?.getTime() ?? null }
        : null,
    },
  }
}

export async function resolveConversationIdentity(
  input: z.infer<typeof identityInput>,
) {
  return (await resolveConversationAccess(input)).identity
}

export type ConversationIdentity = Awaited<
  ReturnType<typeof resolveConversationIdentity>
>
