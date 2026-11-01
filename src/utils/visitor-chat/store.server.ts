import { and, count, desc, eq, gt, ilike, isNull, lt, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { setTag } from '@sentry/tanstackstart-react'
import {
  liveSessions,
  liveTabs,
  visitorChats,
  visitorChatMessages,
} from '~/db/schema'
import { requireAdmin } from '~/utils/roles.server'
import {
  isLivePage,
  LIVE_TIMEOUT_MS,
  LIVE_RETENTION_MS,
} from '~/utils/analytics/live'
import {
  chatMessageInput,
  chatMessageSchema,
  chatStateSchema,
} from './contract'
import { hashChatProof, visitorChatConfig } from './auth.server'
export class ChatNotFoundError extends Error {}
class ChatClosedError extends Error {}

export async function requireVisitorChatAdmin() {
  setTag('visitor-chat', 'true')
  const auth = await requireAdmin()
  if (!(await visitorChatConfig()).enabled)
    throw new Error('Visitor chat is not enabled')
  return auth.currentUser
}
export async function readChat(chatId: string, before?: number) {
  const [chat] = await db
    .select()
    .from(visitorChats)
    .where(eq(visitorChats.id, chatId))
    .limit(1)
  if (!chat) throw new ChatNotFoundError('Chat not found')
  const rows = await db
    .select()
    .from(visitorChatMessages)
    .where(
      and(
        eq(visitorChatMessages.chatId, chatId),
        before ? lt(visitorChatMessages.sequence, before) : undefined,
      ),
    )
    .orderBy(desc(visitorChatMessages.sequence))
    .limit(101)
  return chatStateSchema.parse({
    id: chat.id,
    closed: Boolean(chat.closedAt),
    muted: Boolean(chat.mutedAt),
    deliveredThrough: chat.deliveredThrough,
    readThrough: chat.readThrough,
    lastVisitorSeenAt: chat.lastVisitorSeenAt,
    messages: rows.slice(0, 100).reverse(),
    hasOlder: rows.length > 100,
  })
}
export async function listAdminChats(search: string, includeClosed: boolean) {
  await requireVisitorChatAdmin()
  const chats = await db
    .select({
      id: visitorChats.id,
      originSessionId: visitorChats.originSessionId,
      company: visitorChats.company,
      closedAt: visitorChats.closedAt,
      mutedAt: visitorChats.mutedAt,
      updatedAt: visitorChats.updatedAt,
      lastVisitorSeenAt: visitorChats.lastVisitorSeenAt,
      lastSenderRole:
        sql`(SELECT sender_role FROM visitor_chat_messages WHERE chat_id = ${visitorChats.id} ORDER BY sequence DESC LIMIT 1)`.mapWith(
          chatMessageSchema.shape.senderRole.nullable().parse,
        ),
    })
    .from(visitorChats)
    .where(
      and(
        includeClosed ? undefined : isNull(visitorChats.closedAt),
        search
          ? ilike(
              sql`coalesce(${visitorChats.company}->>'name', '') || ' ' || coalesce(${visitorChats.company}->>'domain', '') || ' ' || ${visitorChats.originSessionId}::text`,
              `%${search}%`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(visitorChats.updatedAt))
    .limit(201)
  return { chats: chats.slice(0, 200), truncated: chats.length > 200 }
}
export async function chatsNeedingReply() {
  const [row] = await db
    .select({ count: count() })
    .from(visitorChats)
    .where(
      and(
        isNull(visitorChats.closedAt),
        isNull(visitorChats.mutedAt),
        sql`(SELECT sender_role FROM visitor_chat_messages WHERE chat_id = ${visitorChats.id} ORDER BY sequence DESC LIMIT 1) = 'visitor'`,
      ),
    )
  return row.count
}
export async function createAdminTestChat() {
  const user = await requireVisitorChatAdmin()
  const [chat] = await db
    .insert(visitorChats)
    .values({
      originSessionId: crypto.randomUUID(),
      visitorProofHash: await hashChatProof(crypto.randomUUID()),
      company: {
        name: 'Test chat',
        domain: 'test.invalid',
        industry: null,
        company_size: null,
        linkedin_url: null,
      },
    })
    .returning()
  await appendAdminMessage(
    chat.id,
    {
      id: crypto.randomUUID(),
      body: 'This is your test chat. Reply here to try the visitor experience.',
    },
    user,
  )
  return {
    chatId: chat.id,
    sessionId: chat.originSessionId,
    label: 'Test chat · You',
  }
}

export async function startAdminChat(sessionId: string, value: unknown) {
  const user = await requireVisitorChatAdmin()
  return openChatForSession(sessionId, value, user)
}
export async function openChatForSession(
  sessionId: string,
  value: unknown,
  user: Awaited<ReturnType<typeof requireVisitorChatAdmin>>,
) {
  const input = chatMessageInput.parse(value)
  const tabs = await db
    .select({ session: liveSessions, page: liveTabs.page })
    .from(liveSessions)
    .innerJoin(liveTabs, eq(liveTabs.sessionId, liveSessions.id))
    .where(
      and(
        eq(liveSessions.id, sessionId),
        gt(liveSessions.createdAt, new Date(Date.now() - LIVE_RETENTION_MS)),
        isNull(liveTabs.leftAt),
        gt(liveTabs.lastSeen, new Date(Date.now() - LIVE_TIMEOUT_MS)),
      ),
    )
    .limit(100)
  const session = tabs.find((tab) => isLivePage(tab.page))?.session
  if (!session?.chatProofHash)
    throw new Error('Chat is available after this visitor reloads their page.')
  if (session.visitorChatId)
    return appendAdminMessage(session.visitorChatId, input, user)
  const [chat] = await db
    .insert(visitorChats)
    .values({
      originSessionId: sessionId,
      visitorProofHash: session.chatProofHash,
      company: session.company,
    })
    .onConflictDoUpdate({
      target: visitorChats.originSessionId,
      set: { originSessionId: sessionId },
    })
    .returning()
  await db
    .update(liveSessions)
    .set({ visitorChatId: chat.id })
    .where(eq(liveSessions.id, sessionId))
  return appendAdminMessage(chat.id, input, user)
}
async function appendAdminMessage(
  chatId: string,
  input: ReturnType<typeof chatMessageInput.parse>,
  user: Awaited<ReturnType<typeof requireVisitorChatAdmin>>,
) {
  return appendMessage(chatId, input, {
    senderRole: 'admin',
    senderId: user.userId,
    senderName: user.displayUsername || user.name || 'TanStack team',
    senderImage: user.image || user.oauthImage,
  })
}
export async function sendAdminChat(chatId: string, value: unknown) {
  const user = await requireVisitorChatAdmin()
  return appendAdminMessage(chatId, chatMessageInput.parse(value), user)
}
export async function appendMessage(
  chatId: string,
  input: ReturnType<typeof chatMessageInput.parse>,
  sender: {
    senderRole: 'admin' | 'visitor'
    senderId: string | null
    senderName: string
    senderImage: string | null
  },
) {
  try {
    await db.transaction(async (tx) => {
      // The conversation row lock serializes concurrent admins and visitor replies.
      const [chat] = await tx
        .select()
        .from(visitorChats)
        .where(eq(visitorChats.id, chatId))
        .for('update')
      if (!chat || chat.closedAt || chat.mutedAt)
        throw new ChatClosedError('This chat is closed or muted')
      const [existing] = await tx
        .select({ id: visitorChatMessages.id })
        .from(visitorChatMessages)
        .where(
          and(
            eq(visitorChatMessages.chatId, chatId),
            eq(visitorChatMessages.id, input.id),
          ),
        )
      if (existing) return
      const sequence = chat.nextSequence + 1
      await tx
        .insert(visitorChatMessages)
        .values({ id: input.id, chatId, sequence, ...sender, body: input.body })
      await tx
        .update(visitorChats)
        .set({ nextSequence: sequence, updatedAt: new Date() })
        .where(eq(visitorChats.id, chatId))
    })
  } catch (error) {
    if (error instanceof ChatClosedError) throw error
    // Driver errors can include SQL parameters, including message text.
    throw new Error('Could not save the message. Please try again.')
  }
  return readChat(chatId)
}
export async function closeAdminChat(chatId: string) {
  await requireVisitorChatAdmin()
  await db
    .update(visitorChats)
    .set({ closedAt: new Date() })
    .where(eq(visitorChats.id, chatId))
  return readChat(chatId)
}
export async function deleteAdminChat(chatId: string) {
  await requireVisitorChatAdmin()
  await db.delete(visitorChats).where(eq(visitorChats.id, chatId))
}
export async function reopenAdminChat(chatId: string) {
  await requireVisitorChatAdmin()
  await db
    .update(visitorChats)
    .set({ closedAt: null })
    .where(and(eq(visitorChats.id, chatId), isNull(visitorChats.mutedAt)))
  return readChat(chatId)
}
export async function acknowledgeVisitorChat(
  chatId: string,
  deliveredThrough: number,
  readThrough: number,
) {
  await db
    .update(visitorChats)
    .set({
      lastVisitorSeenAt: new Date(),
      deliveredThrough: sql`greatest(${visitorChats.deliveredThrough}, least(${deliveredThrough}, ${visitorChats.nextSequence}))`,
      readThrough: sql`greatest(${visitorChats.readThrough}, least(${Math.min(readThrough, deliveredThrough)}, ${visitorChats.nextSequence}))`,
    })
    .where(eq(visitorChats.id, chatId))
}
