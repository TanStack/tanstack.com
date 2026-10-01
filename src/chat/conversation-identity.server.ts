import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import {
  chatBots,
  chatConversations,
  chatConversationMains,
  chatMemberships,
} from '~/db/schema'

const identityInput = z
  .object({
    userId: z.string().uuid(),
    workspaceId: z.string().min(1).max(1000),
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
export async function resolveConversationIdentity(
  input: z.infer<typeof identityInput>,
) {
  const parsed = identityInput.safeParse(input)
  if (!parsed.success) throw new ConversationIdentityError()
  const value = parsed.data
  const conditions = [
    eq(chatBots.workspaceId, value.workspaceId),
    eq(chatMemberships.userId, value.userId),
    eq(chatConversations.userId, value.userId),
  ]
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
    .where(and(...conditions))
    .limit(2)
  if (rows.length !== 1) throw new ConversationIdentityError()
  return rows[0]
}

export type ConversationIdentity = Awaited<
  ReturnType<typeof resolveConversationIdentity>
>
