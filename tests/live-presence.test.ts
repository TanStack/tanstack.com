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
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.MODE': '"production"',
  },
})

async function browser(
  options: { dnt?: string; gpc?: boolean; cookie?: string } = {},
) {
  const events: Blob[] = []
  const handlers = new Map<string, () => void>()
  let heartbeat = () => {}
  let cookie = options.cookie ?? ''
  const location = {
    hostname: 'tanstack.com',
    pathname: '/query/latest/docs/framework/react/overview',
  }
  const document = {
    visibilityState: 'visible',
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
