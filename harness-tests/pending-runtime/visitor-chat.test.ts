import { afterAll, expect, it } from 'vitest'
import postgres from 'postgres'
import type { AuthUser } from '../../src/auth/types'
import { runWithHostRuntimeEnv } from '../../src/server/runtime/host.server'
import {
  recordLiveEvent,
  pruneLiveVisitors,
  receiveLiveEvent,
} from '../../src/utils/analytics/live.server'
import { type LiveEvent } from '../../src/utils/analytics/live'
import {
  chatCookieHeader,
  hashChatProof,
} from '../../src/utils/visitor-chat/auth.server'
import {
  acknowledgeVisitorChat,
  chatsNeedingReply,
  createAdminTestChat,
  appendMessage,
  openChatForSession,
  readChat,
  startAdminChat,
} from '../../src/utils/visitor-chat/store.server'
import {
  offerVisitorChat,
  receiveVisitorChat,
} from '../../src/utils/visitor-chat/visitor.server'
import { chatStateSchema } from '../../src/utils/visitor-chat/contract'

const url = new URL(process.env.DATABASE_URL ?? '')
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !url.pathname.startsWith('/tanchat_test')
)
  throw new Error(
    'Visitor chat tests require a disposable local tanchat_test database',
  )
const sql = postgres(url.href, { max: 1 })
const admin: AuthUser = {
  userId: crypto.randomUUID(),
  email: 'tanner@example.invalid',
  name: 'Tanner',
  displayUsername: 'Tanner',
  image: 'https://example.invalid/tanner.jpg',
  oauthImage: null,
  capabilities: ['admin'],
  adsDisabled: null,
  interestedInHidingAds: null,
  lastUsedFramework: null,
  signupSources: [],
}
const jonny: AuthUser = {
  ...admin,
  userId: crypto.randomUUID(),
  name: 'Jonny',
  displayUsername: 'Jonny',
  image: 'https://example.invalid/jonny.jpg',
}
const event: LiveEvent = {
  sessionId: crypto.randomUUID(),
  tabId: crypto.randomUUID(),
  sequence: 1,
  page: '/query/latest',
  visible: true,
  kind: 'update',
  chatProof: crypto.randomUUID(),
}
const ids: string[] = []
const sessionIds = [event.sessionId]
const environment = {
  VISITOR_CHAT_ENABLED: 'true',
  LIVE_VISITORS_ENABLED: 'true',
  SESSION_SECRET: 'local-chat-test-secret',
  LIVE_PRESENCE_RATE_LIMITER: { limit: async () => ({ success: true }) },
  VISITOR_CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
}
const message = (body: string) => ({ id: crypto.randomUUID(), body })
const visitorRequest = (cookie: string, body?: unknown) =>
  new Request('https://tanstack.com/_a/visitor-chat', {
    method: body ? 'POST' : 'GET',
    headers: {
      cookie,
      origin: 'https://tanstack.com',
      'cf-connecting-ip': '192.0.2.1',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
afterAll(async () => {
  for (const id of ids) await sql`DELETE FROM visitor_chats WHERE id=${id}`
  for (const id of sessionIds)
    await sql`DELETE FROM live_sessions WHERE id=${id}`
  await sql`DELETE FROM users WHERE id IN (${admin.userId},${jonny.userId})`
  await sql.end()
})
it('keeps a private, shared, durable conversation through concurrent admins, retries, reloads and session expiry', async () => {
  await runWithHostRuntimeEnv(environment, async () => {
    const pendingBefore = await chatsNeedingReply()
    await sql`INSERT INTO users(id) VALUES (${admin.userId}),(${jonny.userId})`
    await expect(
      startAdminChat(event.sessionId, message('unauthenticated')),
    ).rejects.toThrow()
    await expect(createAdminTestChat()).rejects.toThrow()
    await recordLiveEvent(event, '192.0.2.1', undefined, undefined)
    const baseline = new Request('https://tanstack.com/_a/live', {
      method: 'POST',
      headers: {
        origin: 'https://tanstack.com',
        'cf-connecting-ip': '192.0.2.1',
      },
      body: JSON.stringify({ ...event, sequence: 2 }),
    })
    expect((await receiveLiveEvent(baseline)).status).toBe(204)
    const [first, second] = await Promise.all([
      openChatForSession(event.sessionId, message('Tanner opening'), admin),
      openChatForSession(event.sessionId, message('Jonny joining'), jonny),
    ])
    expect(first.id).toBe(second.id)
    ids.push(first.id)
    const chatId = first.id
    const announcement = await receiveLiveEvent(
      new Request('https://tanstack.com/_a/live', {
        method: 'POST',
        headers: {
          origin: 'https://tanstack.com',
          'cf-connecting-ip': '192.0.2.1',
        },
        body: JSON.stringify({ ...event, sequence: 3 }),
      }),
    )
    expect(announcement.status).toBe(200)
    expect(announcement.headers.getSetCookie()).toHaveLength(2)
    expect(
      announcement.headers
        .getSetCookie()
        .some((value) => value.startsWith('__Host-tanstack_chat_started=1;')),
    ).toBe(true)
    const shared = await readChat(chatId)
    expect(shared.messages.map((m) => m.sequence)).toEqual([1, 2])
    expect(new Set(shared.messages.map((m) => m.senderName))).toEqual(
      new Set(['Tanner', 'Jonny']),
    )
    expect(
      shared.messages.every((m) =>
        m.senderImage?.startsWith('https://example.invalid/'),
      ),
    ).toBe(true)
    const wrongProof = { ...event, chatProof: crypto.randomUUID() }
    expect(
      await offerVisitorChat(
        new Request('https://tanstack.com/_a/live'),
        wrongProof,
        false,
      ),
    ).toBeNull()
    const offer = await offerVisitorChat(
      new Request('https://tanstack.com/_a/live'),
      event,
      false,
    )
    expect(offer?.chat).toBe(true)
    const cookie = offer!.cookie!.split(';')[0]
    const loaded = await receiveVisitorChat(visitorRequest(cookie))
    expect(loaded.status).toBe(200)
    const body = await loaded.text()
    expect(body).not.toContain('visitorProofHash')
    expect(body).not.toContain(event.chatProof!)
    expect(body).not.toContain(admin.email)
    expect(body).not.toContain('senderId')
    const reply = message('visitor reply')
    const sent = await receiveVisitorChat(
      visitorRequest(cookie, {
        action: 'send',
        message: { ...reply, senderRole: 'admin', senderName: 'Tanner' },
        chatId: crypto.randomUUID(),
      }),
    )
    expect(sent.status).toBe(200)
    expect(await chatsNeedingReply()).toBe(pendingBefore + 1)
    const sentState = chatStateSchema.parse(await sent.json())
    expect(sentState.messages.at(-1)?.senderRole).toBe('visitor')
    expect(sentState.messages.at(-1)?.senderName).toBe('Visitor')
    await receiveVisitorChat(
      visitorRequest(cookie, { action: 'send', message: reply }),
    )
    expect((await readChat(chatId)).messages).toHaveLength(3)
    const next = await appendMessage(chatId, message('admin after snapshot'), {
      senderRole: 'admin',
      senderId: admin.userId,
      senderName: 'Tanner',
      senderImage: null,
    })
    expect(next.messages).toHaveLength(4)
    expect(await chatsNeedingReply()).toBe(pendingBefore)
    await acknowledgeVisitorChat(chatId, 3, 3)
    expect((await readChat(chatId)).deliveredThrough).toBe(3)
    expect((await readChat(chatId)).readThrough).toBe(3)
    const reloaded = chatStateSchema.parse(
      await (await receiveVisitorChat(visitorRequest(cookie))).json(),
    )
    expect(reloaded.messages).toHaveLength(4)
    const otherId = crypto.randomUUID()
    ids.push(otherId)
    await sql`INSERT INTO visitor_chats(id,origin_session_id,visitor_proof_hash) VALUES (${otherId},${crypto.randomUUID()},${await hashChatProof(crypto.randomUUID())})`
    const otherCookie = (await chatCookieHeader(otherId)).split(';')[0]
    const otherState = chatStateSchema.parse(
      await (await receiveVisitorChat(visitorRequest(otherCookie))).json(),
    )
    expect(otherState.messages).toHaveLength(0)
    await expect(
      appendMessage(
        otherId,
        { id: reply.id, body: 'private-text-must-not-appear-in-errors' },
        {
          senderRole: 'visitor',
          senderId: null,
          senderName: 'Visitor',
          senderImage: null,
        },
      ),
    ).rejects.toThrow('Could not save the message. Please try again.')
    await sql`UPDATE live_sessions SET created_at=now()-interval '2 days' WHERE id=${event.sessionId}`
    await pruneLiveVisitors(Date.now())
    expect((await readChat(chatId)).messages).toHaveLength(4)
    expect((await receiveVisitorChat(visitorRequest(cookie))).status).toBe(200)
    const stopped = await receiveVisitorChat(
      visitorRequest(cookie, { action: 'stop' }),
    )
    expect(stopped.status).toBe(204)
    expect(
      stopped.headers
        .getSetCookie()
        .some((value) => value.startsWith('__Host-tanstack_chat_started=;')),
    ).toBe(true)
    expect(stopped.headers.get('set-cookie')).toContain(
      'visitor_chat_stopped=1',
    )
    expect(
      (
        await receiveVisitorChat(
          visitorRequest(cookie, {
            action: 'send',
            message: message('blocked'),
          }),
        )
      ).status,
    ).toBe(409)
    expect(
      await offerVisitorChat(
        new Request('https://tanstack.com/_a/live', { headers: { cookie } }),
        event,
        false,
      ),
    ).toBeNull()
    await sql`DELETE FROM visitor_chats WHERE id=${chatId}`
    const [remaining] =
      await sql`SELECT count(*)::int AS count FROM visitor_chat_messages WHERE chat_id=${chatId}`
    expect(remaining.count).toBe(0)
    expect((await receiveVisitorChat(visitorRequest(cookie))).status).toBe(404)
    const fresh = {
      ...event,
      sessionId: crypto.randomUUID(),
      tabId: crypto.randomUUID(),
      chatProof: crypto.randomUUID(),
    }
    sessionIds.push(fresh.sessionId)
    await recordLiveEvent(fresh, '192.0.2.1', undefined, undefined)
    const replacement = await openChatForSession(
      fresh.sessionId,
      message('New conversation after deletion'),
      admin,
    )
    ids.push(replacement.id)
    const replacementOffer = await offerVisitorChat(
      new Request('https://tanstack.com/_a/live', { headers: { cookie } }),
      fresh,
      false,
    )
    expect(replacementOffer?.cookie).toBeTruthy()
    const replacementCookie = replacementOffer!.cookie!.split(';')[0]
    expect(
      chatStateSchema.parse(
        await (
          await receiveVisitorChat(visitorRequest(replacementCookie))
        ).json(),
      ).id,
    ).toBe(replacement.id)
    expect(
      await offerVisitorChat(
        new Request('https://tanstack.com/_a/live', {
          headers: {
            cookie: `${replacementCookie}; __Host-tanstack_visitor_chat_stopped=1`,
          },
        }),
        fresh,
        false,
      ),
    ).toBeNull()
  })
})

it('pages through retained history without truncating it permanently', async () => {
  const id = crypto.randomUUID()
  ids.push(id)
  await sql`INSERT INTO visitor_chats(id,origin_session_id,visitor_proof_hash,next_sequence) VALUES (${id},${crypto.randomUUID()},${await hashChatProof(crypto.randomUUID())},205)`
  await sql`INSERT INTO visitor_chat_messages(id,chat_id,sequence,sender_role,sender_name,body) SELECT gen_random_uuid(),${id},n,'visitor','Visitor','Synthetic history message' FROM generate_series(1,205) n`
  const recent = await readChat(id)
  expect(recent.messages).toHaveLength(100)
  expect(recent.messages[0].sequence).toBe(106)
  expect(recent.hasOlder).toBe(true)
  const middle = await readChat(id, 106)
  expect(middle.messages[0].sequence).toBe(6)
  const first = await readChat(id, 6)
  expect(first.messages.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5])
  expect(first.hasOlder).toBe(false)
})
