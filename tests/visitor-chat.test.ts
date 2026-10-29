import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SessionService } from '../src/auth/session.server.ts'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server.ts'
import {
  chatCookieHeader,
  chatIdFromCookie,
  hashChatProof,
} from '../src/utils/visitor-chat/auth.server.ts'
import { receiveVisitorChat } from '../src/utils/visitor-chat/visitor.server.ts'
import {
  chatMessageInput,
  mergeChatState,
  visitorChatCookie,
  type VisitorChatState,
} from '../src/utils/visitor-chat/contract.ts'
import { redactByokRequestHeaders } from '../src/utils/sentry-redaction.ts'

const secret = 'visitor-chat-test-signing-key'
test('visitor cookies are signed, private, and cannot be replayed as account cookies', async () => {
  await runWithHostRuntimeEnv({ SESSION_SECRET: secret }, async () => {
    const id = crypto.randomUUID()
    const header = await chatCookieHeader(id)
    assert.match(header, /HttpOnly; Secure; SameSite=Lax/)
    const cookie = header.split(';')[0]
    assert.equal(
      await chatIdFromCookie(
        new Request('https://tanstack.com', { headers: { cookie } }),
      ),
      id,
    )
    assert.equal(
      await chatIdFromCookie(
        new Request('https://tanstack.com', {
          headers: { cookie: `${visitorChatCookie}=${id}` },
        }),
      ),
      null,
    )
    const account = await new SessionService(secret).signCookie({
      userId: id,
      version: 0,
      expiresAt: Date.now() + 60000,
    })
    assert.equal(
      await chatIdFromCookie(
        new Request('https://tanstack.com', {
          headers: { cookie: `${visitorChatCookie}=${account}` },
        }),
      ),
      null,
    )
    const value = cookie.slice(visitorChatCookie.length + 1)
    assert.equal(await new SessionService(secret).verifyCookie(value), null)
    assert.notEqual(await hashChatProof(id), id)
  })
})
test('visitor chat rejects disabled service, cross-site posts, unsigned cookies and missing limits before querying messages', async () => {
  const request = (headers: Record<string, string> = {}, method = 'POST') =>
    new Request('https://tanstack.com/_a/visitor-chat', {
      method,
      headers: {
        origin: 'https://tanstack.com',
        'cf-connecting-ip': '192.0.2.1',
        ...headers,
      },
      body: method === 'POST' ? '{}' : undefined,
    })
  assert.equal(
    (
      await runWithHostRuntimeEnv({ VISITOR_CHAT_ENABLED: 'false' }, () =>
        receiveVisitorChat(request()),
      )
    ).status,
    404,
  )
  await runWithHostRuntimeEnv(
    {
      VISITOR_CHAT_ENABLED: 'true',
      SESSION_SECRET: secret,
      VISITOR_CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    },
    async () => {
      assert.equal(
        (await receiveVisitorChat(request({ origin: 'https://other.example' })))
          .status,
        403,
      )
      assert.equal((await receiveVisitorChat(request())).status, 401)
      assert.equal(
        (
          await receiveVisitorChat(
            request({ cookie: '__Host-tanstack_chat_started=1' }),
          )
        ).status,
        401,
      )
      assert.equal(
        (await receiveVisitorChat(request({}, 'DELETE'))).status,
        405,
      )
    },
  )
  assert.equal(
    (
      await runWithHostRuntimeEnv({ VISITOR_CHAT_ENABLED: 'true' }, () =>
        receiveVisitorChat(request()),
      )
    ).status,
    503,
  )
})
test('messages are bounded and retries and history pages merge without duplicates or losing older history', () => {
  assert.equal(
    chatMessageInput.safeParse({ id: crypto.randomUUID(), body: ' '.repeat(4) })
      .success,
    false,
  )
  assert.equal(
    chatMessageInput.safeParse({
      id: crypto.randomUUID(),
      body: 'x'.repeat(4001),
    }).success,
    false,
  )
  const message = (sequence: number) => ({
    id: crypto.randomUUID(),
    sequence,
    senderRole: 'visitor',
    senderName: 'Visitor',
    senderImage: null,
    body: 'hello',
    createdAt: new Date(),
  })
  const first: VisitorChatState = {
    id: crypto.randomUUID(),
    closed: false,
    muted: false,
    deliveredThrough: 0,
    readThrough: 0,
    lastVisitorSeenAt: null,
    messages: [{ ...message(2), senderRole: 'visitor' }],
    hasOlder: true,
  }
  const later: VisitorChatState = {
    ...first,
    messages: [first.messages[0], { ...message(3), senderRole: 'visitor' }],
  }
  const merged = mergeChatState(first, later)
  assert.deepEqual(
    merged.messages.map((m) => m.sequence),
    [2, 3],
  )
  const older: VisitorChatState = {
    ...first,
    messages: [{ ...message(1), senderRole: 'visitor' }],
    hasOlder: false,
  }
  const complete = mergeChatState(merged, older, true)
  assert.deepEqual(
    complete.messages.map((m) => m.sequence),
    [1, 2, 3],
  )
  assert.equal(mergeChatState(complete, later).hasOlder, false)
})
test('chat and presence errors never send messages, credentials, visitor details or SQL parameters to Sentry', () => {
  for (const url of [
    'https://tanstack.com/_a/live',
    'https://tanstack.com/_a/visitor-chat',
  ]) {
    const event = {
      request: {
        url,
        headers: { cookie: 'private-cookie' },
        data: 'private-message',
        cookies: { private: 'value' },
      },
      user: { ip_address: '192.0.2.1' },
      extra: { query: 'private-message' },
      contexts: { request: { body: 'private-message' } },
      breadcrumbs: [{ message: 'private-message' }],
      exception: { values: [{ value: 'private-message SQL parameters' }] },
    }
    const result = JSON.stringify(redactByokRequestHeaders(event))
    assert.equal(result.includes('private-'), false)
    assert.equal(result.includes('192.0.2.1'), false)
  }
  const event = {
    tags: { 'visitor-chat': 'true' },
    request: {
      url: 'https://tanstack.com/_serverFn/admin-chat?payload=private-message',
      data: 'private-message',
    },
  }
  assert.equal(
    JSON.stringify(redactByokRequestHeaders(event)).includes('private-message'),
    false,
  )
})

test('clipboard analytics skip chat fields and selections that contain a private chat region', async (t) => {
  const { trackScarfClipboardEvent } =
    await import('../src/utils/analytics/scarf.ts')
  class TestElement extends EventTarget {
    constructor(readonly privateRegion: boolean) {
      super()
    }
    closest() {
      return this.privateRegion ? this : null
    }
  }
  const privateElement = new TestElement(true)
  const publicElement = new TestElement(false)
  class CopyEvent extends Event {
    clipboardData = null
    constructor(readonly source: TestElement) {
      super('copy')
    }
    get target() {
      return this.source
    }
  }
  const previousElement = Object.getOwnPropertyDescriptor(globalThis, 'Element')
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  )
  t.after(() => {
    if (previousElement)
      Object.defineProperty(globalThis, 'Element', previousElement)
    else Reflect.deleteProperty(globalThis, 'Element')
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  Object.defineProperty(globalThis, 'Element', {
    value: TestElement,
    configurable: true,
  })
  assert.doesNotThrow(() =>
    trackScarfClipboardEvent(new CopyEvent(privateElement)),
  )
  Object.defineProperty(globalThis, 'document', {
    value: {
      getSelection: () => ({ containsNode: () => true }),
      querySelectorAll: () => [privateElement],
    },
    configurable: true,
  })
  assert.doesNotThrow(() =>
    trackScarfClipboardEvent(new CopyEvent(publicElement)),
  )
})

test('chat credentials are redacted even when an unrelated page fails', () => {
  const event = {
    request: {
      url: 'https://tanstack.com/query/latest',
      cookies: { private: 'credential' },
      headers: {
        cookie: 'private-credential',
        'Set-Cookie': 'private-credential',
        Accept: 'text/html',
      },
    },
  }
  const result = redactByokRequestHeaders(event)
  assert.deepEqual(result.request.headers, { Accept: 'text/html' })
  assert.equal(JSON.stringify(result).includes('private-credential'), false)
})
