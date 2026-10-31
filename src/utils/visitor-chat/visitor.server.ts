import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import { liveSessions, visitorChats } from '~/db/schema'
import {
  chatMessageInput,
  visitorChatCookie,
  visitorChatTestCookie,
  visitorChatCookieAge,
} from './contract'
import { visitorChatHintCookie } from './bootstrap'
import {
  chatCookieHeader,
  chatIdFromCookie,
  hashChatProof,
  visitorChatConfig,
} from './auth.server'
import {
  acknowledgeVisitorChat,
  appendMessage,
  ChatNotFoundError,
  readChat,
} from './store.server'
import type { LiveEvent } from '~/utils/analytics/live'

const stopCookie = '__Host-tanstack_visitor_chat_stopped'
export async function offerVisitorChat(
  request: Request,
  event: LiveEvent,
  created: boolean,
) {
  if (
    event.kind !== 'update' ||
    !event.chatProof ||
    !(await visitorChatConfig()).enabled
  )
    return null
  if (request.headers.get('cookie')?.split('; ').includes(`${stopCookie}=1`))
    return null
  const proofHash = await hashChatProof(event.chatProof)
  const cookieId = await chatIdFromCookie(request)
  let [chat] = cookieId
    ? await db
        .select()
        .from(visitorChats)
        .where(eq(visitorChats.id, cookieId))
        .limit(1)
    : []
  if (!chat)
    [chat] = await db
      .select()
      .from(visitorChats)
      .where(
        and(
          eq(visitorChats.originSessionId, event.sessionId),
          eq(visitorChats.visitorProofHash, proofHash),
        ),
      )
      .limit(1)
  if (
    !chat ||
    chat.mutedAt ||
    (chat.closedAt && chat.id !== cookieId) ||
    !chat.nextSequence
  )
    return null
  if (created)
    await db
      .update(liveSessions)
      .set({ visitorChatId: chat.id })
      .where(
        and(
          eq(liveSessions.id, event.sessionId),
          eq(liveSessions.chatProofHash, proofHash),
        ),
      )
  return {
    chat: true,
    cookie: cookieId === chat.id ? undefined : await chatCookieHeader(chat.id),
  }
}
const visitorRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('read'),
    through: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
  }),
  z.object({ action: z.literal('send'), message: chatMessageInput }),
  z.object({ action: z.literal('stop') }),
])
export async function receiveVisitorChat(request: Request) {
  try {
    return await handleVisitorChat(request)
  } catch {
    return new Response(null, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
async function handleVisitorChat(request: Request) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  }
  const testId = new URL(request.url).searchParams.get('test')
  const test = testId !== null
  const respond = (status: number) => new Response(null, { status, headers })
  const forget = (status: number) => {
    const values = new Headers(headers)
    for (const name of test
      ? [visitorChatTestCookie]
      : [visitorChatCookie, visitorChatHintCookie])
      values.append(
        'Set-Cookie',
        `${name}=; Path=/; Secure; SameSite=Lax; Max-Age=0${name !== visitorChatHintCookie ? '; HttpOnly' : ''}`,
      )
    return new Response(null, { status, headers: values })
  }
  const config = await visitorChatConfig()
  if (!config.enabled) return respond(404)
  if (!['GET', 'POST'].includes(request.method)) return respond(405)
  const url = new URL(request.url)
  if (request.method === 'POST' && request.headers.get('origin') !== url.origin)
    return respond(403)
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return respond(403)
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip || !config.limiter) return respond(503)
  if (!(await config.limiter.limit({ key: ip })).success) return respond(429)
  const chatId = await chatIdFromCookie(request, test)
  if (testId && chatId && testId !== chatId) return respond(409)
  if (!chatId) return forget(401)
  const state = await readChat(chatId).catch((error) => {
    if (error instanceof ChatNotFoundError) return null
    throw error
  })
  if (!state) return forget(404)
  if (request.method === 'GET') {
    const beforeValue = url.searchParams.get('before')
    const before = beforeValue
      ? z.coerce.number().int().positive().safeParse(beforeValue)
      : undefined
    if (before && !before.success) return respond(400)
    const page = before?.success ? await readChat(chatId, before.data) : state
    return Response.json(page, { headers })
  }
  const reader = request.body?.getReader()
  if (!reader) return respond(400)
  let size = 0
  let body = ''
  const decoder = new TextDecoder()
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > 20_000) {
      await reader.cancel()
      return respond(413)
    }
    body += decoder.decode(chunk.value, { stream: true })
  }
  let input: unknown
  try {
    input = JSON.parse(body + decoder.decode())
  } catch {
    return respond(400)
  }
  const parsed = visitorRequestSchema.safeParse(input)
  if (!parsed.success) return respond(400)
  if (parsed.data.action === 'stop') {
    await db
      .update(visitorChats)
      .set({ mutedAt: new Date() })
      .where(eq(visitorChats.id, chatId))
    if (test) return forget(204)
    const values = new Headers(headers)
    values.append(
      'Set-Cookie',
      `${stopCookie}=1; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${visitorChatCookieAge}`,
    )
    values.append(
      'Set-Cookie',
      `${visitorChatHintCookie}=; Path=/; Secure; SameSite=Lax; Max-Age=0`,
    )
    return new Response(null, { status: 204, headers: values })
  }
  if (parsed.data.action === 'read') {
    await acknowledgeVisitorChat(
      chatId,
      parsed.data.delivered,
      parsed.data.through,
    )
    return respond(204)
  }
  if (state.closed || state.muted) return respond(409)
  return Response.json(
    await appendMessage(chatId, parsed.data.message, {
      senderRole: 'visitor',
      senderId: null,
      senderName: 'Visitor',
      senderImage: null,
    }),
    { headers },
  )
}
