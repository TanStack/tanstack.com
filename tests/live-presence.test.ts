import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { isLivePage, liveEventSchema } from '../src/utils/analytics/live.ts'

const browserBundle = build({
  entryPoints: ['src/utils/analytics/live-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'liveBrowser',
  plugins: [
    {
      name: 'chat-ui-boundary',
      setup(build) {
        build.onResolve(
          { filter: /components\/visitor-chat\/VisitorChat$/ },
          () => ({ path: 'chat-ui', namespace: 'chat-ui-test' }),
        )
        build.onLoad({ filter: /.*/, namespace: 'chat-ui-test' }, () => ({
          contents:
            'export function mountVisitorChat(testId) { globalThis.mountChatForTest(testId) }',
        }))
      },
    },
  ],
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.MODE': '"production"',
  },
})

async function browser(
  options: {
    dnt?: string
    gpc?: boolean
    cookie?: string
    hash?: string
    storage?: Map<string, string>
  } = {},
) {
  const events: Blob[] = []
  const handlers = new Map<string, () => void>()
  let heartbeat = () => {}
  let offerChat = false
  let mountedChats = 0
  let mountedTestId: string | undefined
  const storage = options.storage ?? new Map<string, string>()
  let cookie = options.cookie ?? ''
  const location = {
    hostname: 'tanstack.com',
    hash: options.hash ?? '',
    pathname: '/query/latest/docs/framework/react/overview',
  }
  const document = {
    visibilityState: 'visible',
    getElementById() {
      return mountedChats ? {} : null
    },
    get cookie() {
      return cookie
    },
    set cookie(value: string) {
      cookie = value.split(';')[0]
    },
    addEventListener(name: string, handler: () => void) {
      handlers.set(name, handler)
    },
    removeEventListener(name: string) {
      handlers.delete(name)
    },
  }
  const bundle = await browserBundle
  const api = runInNewContext(`${bundle.outputFiles[0].text}\nliveBrowser`, {
    location,
    document,
    Blob,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    mountChatForTest(testId?: string) {
      mountedTestId = testId
      mountedChats++
    },
    async fetch(_url: string, input: { body: string }) {
      events.push(new Blob([input.body]))
      return {
        status: offerChat ? 200 : 204,
        json: async () => ({ chat: true }),
      }
    },
    crypto: { randomUUID },
    navigator: {
      doNotTrack: options.dnt,
      globalPrivacyControl: options.gpc,
      sendBeacon(_url: string, body: Blob) {
        events.push(body)
        return true
      },
    },
    window: {
      addEventListener(name: string, handler: () => void) {
        handlers.set(name, handler)
      },
      removeEventListener(name: string) {
        handlers.delete(name)
      },
    },
    setInterval(handler: () => void) {
      heartbeat = handler
      return 1
    },
    clearInterval() {},
  })
  const stop = api.startLivePresence()
  return {
    api,
    invite() {
      offerChat = true
      heartbeat()
    },
    mountedChats: () => mountedChats,
    mountedTestId: () => mountedTestId,
    storage,
    location,
    document,
    handlers,
    stop,
    heartbeat: () => heartbeat(),
    messages: async () =>
      Promise.all(
        events.map(async (event) =>
          liveEventSchema.parse(JSON.parse(await event.text())),
        ),
      ),
  }
}

test('presence accepts only public paths and named actions', () => {
  for (const page of [
    '/',
    '/query/latest/docs/framework/react/overview',
    '/partners/scarf',
    '/start',
  ])
    assert.ok(isLivePage(page), page)
  for (const page of [
    '/admin/live',
    '/account',
    '/chat',
    '/builder/private-id',
    '/api/session',
    '/query?email=someone',
    '/query/#secret',
    '/query/../account',
    '/query/%2e%2e/account',
  ])
    assert.equal(isLivePage(page), false, page)
  assert.equal(
    liveEventSchema.safeParse({
      sessionId: randomUUID(),
      tabId: randomUUID(),
      sequence: 1,
      page: '/',
      visible: true,
      kind: 'update',
      action: 'clipboard_text',
    }).success,
    false,
  )
})

test('DNT and GPC prevent session cookies and beacons', async () => {
  for (const options of [{ dnt: '1' }, { gpc: true }]) {
    const visitor = await browser(options)
    visitor.heartbeat()
    assert.deepEqual(await visitor.messages(), [])
    assert.equal(visitor.document.cookie, '')
  }
})

test('navigation and selected actions carry no event properties', async () => {
  const visitor = await browser()
  visitor.api.trackLiveAction('page_view')
  visitor.location.pathname = '/router'
  visitor.api.trackLiveAction('partner_clicked', {
    email: 'private@example.test',
    text: 'secret',
  })
  visitor.document.visibilityState = 'hidden'
  visitor.handlers.get('visibilitychange')?.()
  visitor.handlers.get('pagehide')?.()
  const messages = await visitor.messages()
  assert.deepEqual(
    messages.map((event) => event.sequence),
    [1, 2, 3, 4, 5],
  )
  assert.equal(messages[2].action, 'partner_clicked')
  assert.equal(messages[2].page, '/router')
  assert.equal(messages[3].visible, false)
  assert.equal(messages[4].kind, 'leave')
  assert.ok(
    messages.every((event) => event.sessionId === messages[0].sessionId),
  )
  assert.equal(JSON.stringify(messages).includes('secret'), false)
  visitor.stop()
})

test('private navigation leaves the last public page and stops updates', async () => {
  const visitor = await browser()
  visitor.location.pathname = '/account'
  visitor.api.trackLiveAction('page_view')
  visitor.heartbeat()
  const messages = await visitor.messages()
  assert.equal(messages.length, 2)
  assert.equal(messages[1].kind, 'leave')
  assert.ok(messages.every((event) => !event.page.includes('account')))
  visitor.stop()
})

test('tabs share a session but have independent presence', async () => {
  const first = await browser()
  const second = await browser({ cookie: first.document.cookie })
  const [a] = await first.messages()
  const [b] = await second.messages()
  assert.equal(a.sessionId, b.sessionId)
  assert.notEqual(a.tabId, b.tabId)
  first.handlers.get('pagehide')?.()
  second.heartbeat()
  assert.equal((await second.messages()).at(-1)?.kind, 'update')
  first.stop()
  second.stop()
})

test('an expired session rotates its tab too, and restored pages rejoin', async () => {
  const visitor = await browser()
  const [first] = await visitor.messages()
  visitor.handlers.get('pagehide')?.()
  visitor.handlers.get('pageshow')?.()
  assert.equal((await visitor.messages()).at(-1)?.kind, 'update')
  visitor.document.cookie = `tanstack_live=${first.sessionId}.1`
  visitor.heartbeat()
  const last = (await visitor.messages()).at(-1)
  assert.notEqual(last?.sessionId, first.sessionId)
  assert.notEqual(last?.tabId, first.tabId)
  visitor.stop()
})

test('showcase collection excludes drafts, submission, and editing paths', () => {
  assert.equal(isLivePage('/showcase'), true)
  assert.equal(isLivePage('/showcase/'), true)
  assert.equal(isLivePage('/showcases'), true)
  for (const page of [
    '/showcase/submit',
    '/showcase/submit/',
    '/showcase/edit/123',
    '/showcase/491fa786-94d5-4d42-8c54-df45c7a7c066',
  ]) {
    assert.equal(isLivePage(page), false, page)
  }
})

test('chat UI stays unloaded until an invitation, then mounts only once', async () => {
  const visitor = await browser()
  await new Promise(setImmediate)
  assert.equal(visitor.mountedChats(), 0)
  visitor.invite()
  await new Promise(setImmediate)
  assert.equal(visitor.mountedChats(), 1)
  visitor.heartbeat()
  await new Promise(setImmediate)
  assert.equal(visitor.mountedChats(), 1)
  visitor.stop()
})

test('an initiated chat resumes on private pages independently of presence tracking', async () => {
  const visitor = await browser({
    dnt: '1',
    cookie: '__Host-tanstack_chat_started=1',
  })
  visitor.location.pathname = '/account'
  await visitor.api.resumeVisitorChat()
  assert.equal(visitor.mountedChats(), 1)
  assert.deepEqual(await visitor.messages(), [])
  const idle = await browser({ dnt: '1' })
  await idle.api.resumeVisitorChat()
  assert.equal(idle.mountedChats(), 0)
})

test('test chat resumes only in its own tab and keeps its expected ID across reloads', async () => {
  const id = randomUUID()
  const preview = await browser({ dnt: '1', hash: `#visitor-chat-test=${id}` })
  await preview.api.resumeVisitorChat()
  assert.equal(preview.mountedTestId(), id)
  assert.deepEqual(await preview.messages(), [])
  const reloaded = await browser({ dnt: '1', storage: preview.storage })
  await reloaded.api.resumeVisitorChat()
  assert.equal(reloaded.mountedTestId(), id)
  const otherTab = await browser({ dnt: '1' })
  await otherTab.api.resumeVisitorChat()
  assert.equal(otherTab.mountedChats(), 0)
})
