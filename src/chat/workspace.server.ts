import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '~/db/client'
import { defaultChatPolicy, chatPolicySchema } from './policy'
import {
  chatAccountOnboarding,
  chatBots,
  chatConversations,
  chatConversationMains,
  chatMemberships,
  chatWorkspaces,
} from '~/db/schema'

/** A single transaction makes first-open and concurrent first-open equivalent. */
export async function openPersonalChatWorkspace(userId: string) {
  const workspaceId = `personal:${userId}`
  const assistantId = `assistant:${userId}`
  const conversationId = `chat:${assistantId}:${userId}`
  const [existing] = await db
    .select({ workspace: chatWorkspaces })
    .from(chatWorkspaces)
    .innerJoin(
      chatMemberships,
      and(
        eq(chatMemberships.workspaceId, chatWorkspaces.id),
        eq(chatMemberships.userId, userId),
        eq(chatMemberships.role, 'owner'),
      ),
    )
    .innerJoin(chatAccountOnboarding, eq(chatAccountOnboarding.userId, userId))
    .innerJoin(
      chatBots,
      and(
        eq(chatBots.id, assistantId),
        eq(chatBots.workspaceId, chatWorkspaces.id),
      ),
    )
    .innerJoin(
      chatConversations,
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.botId, chatBots.id),
        eq(chatConversations.userId, userId),
      ),
    )
    .innerJoin(
      chatConversationMains,
      and(
        eq(chatConversationMains.conversationId, chatConversations.id),
        eq(chatConversationMains.botId, chatBots.id),
        eq(chatConversationMains.userId, userId),
      ),
    )
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatWorkspaces.ownerId, userId),
      ),
    )
  if (existing) {
    const bots = await db
      .select()
      .from(chatBots)
      .where(
        and(
          eq(chatBots.workspaceId, workspaceId),
          isNull(chatBots.archivedAt),
          isNull(chatBots.deletedAt),
        ),
      )
    return {
      workspace: {
        ...existing.workspace,
        policy: chatPolicySchema.parse(existing.workspace.policy),
      },
      bots,
      assistantId,
      conversationId,
    }
  }
  return db.transaction(async (tx) => {
    await tx
      .insert(chatWorkspaces)
      .values({
        id: workspaceId,
        ownerId: userId,
        name: 'Personal',
        policy: defaultChatPolicy,
      })
      .onConflictDoNothing()
    await tx
      .insert(chatMemberships)
      .values({ workspaceId, userId, role: 'owner' })
      .onConflictDoNothing()
    await tx
      .insert(chatAccountOnboarding)
      .values({ userId })
      .onConflictDoNothing()
    await tx
      .insert(chatBots)
      .values({
        id: assistantId,
        workspaceId,
        name: 'TanChat',
        purpose: 'Your everyday assistant.',
      })
      .onConflictDoNothing()
    await tx
      .insert(chatConversations)
      .values({ id: conversationId, botId: assistantId, userId })
      .onConflictDoNothing()
    await tx
      .insert(chatConversationMains)
      .values({ conversationId, botId: assistantId, userId })
      .onConflictDoNothing()
    const [workspace] = await tx
      .select()
      .from(chatWorkspaces)
      .where(eq(chatWorkspaces.id, workspaceId))
    const bots = await tx
      .select()
      .from(chatBots)
      .where(
        and(
          eq(chatBots.workspaceId, workspaceId),
          isNull(chatBots.archivedAt),
          isNull(chatBots.deletedAt),
        ),
      )
    if (!workspace || workspace.ownerId !== userId)
      throw new Error('Personal workspace ownership does not match.')
    return {
      workspace: {
        ...workspace,
        policy: chatPolicySchema.parse(workspace.policy),
      },
      bots,
      assistantId,
      conversationId,
    }
  })
}

export async function createPersonalConversation(userId: string) {
  const { workspace } = await openPersonalChatWorkspace(userId)
  const botId = crypto.randomUUID()
  const conversationId = `chat:${botId}:${userId}`
  return db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(chatBots)
      .values({
        id: botId,
        workspaceId: workspace.id,
        name: 'New conversation',
      })
      .returning()
    await tx
      .insert(chatConversations)
      .values({ id: conversationId, botId, userId })
    await tx
      .insert(chatConversationMains)
      .values({ conversationId, botId, userId })
    return { bot, conversationId }
  })
}

/** Check the complete set before changing any conversation. */
export async function archiveConversations(userId: string, botIds: string[]) {
  const ids = [...new Set(botIds)]
  if (!ids.length) return []
  if (ids.some((id) => id.startsWith('assistant:')))
    throw new Error('The personal assistant cannot be archived.')
  return db.transaction(async (tx) => {
    const accessible = await tx
      .select({ id: chatBots.id })
      .from(chatBots)
      .innerJoin(
        chatMemberships,
        and(
          eq(chatMemberships.workspaceId, chatBots.workspaceId),
          eq(chatMemberships.userId, userId),
          inArray(chatMemberships.role, ['owner', 'admin']),
        ),
      )
      .where(and(inArray(chatBots.id, ids), isNull(chatBots.deletedAt)))
      .for('update', { of: [chatBots, chatMemberships] })
    if (accessible.length !== ids.length)
      throw new Error(
        'One or more conversations are unavailable or cannot be changed.',
      )
    return tx
      .update(chatBots)
      .set({ archivedAt: new Date() })
      .where(inArray(chatBots.id, ids))
      .returning({ id: chatBots.id })
  })
}
