import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createOAuthPopupCookie,
  getOAuthPopupChannel,
  isOAuthPopupMode,
} from '../../src/auth/session.server'
import { createOAuthPopupAttempt } from '../../src/auth/oauth-popup-attempt'
import { oauthPopupChannelName } from '../../src/auth/oauth-popup'

const channelId = '00000000-0000-4000-8000-000000000001'
const cookieRequest = (cookie: string) =>
  new Request('https://tanstack.com/auth/callback', {
    headers: { cookie: cookie.split(';')[0] },
  })
it('binds completion channels to the verified OAuth state and retains cookie protections', () => {
  const cookie = createOAuthPopupCookie(true, {
    state: 'verified-state',
    channel: channelId,
  })
  expect(cookie).toContain(
    'HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure',
  )
  expect(isOAuthPopupMode(cookieRequest(cookie))).toBe(true)
  expect(getOAuthPopupChannel(cookieRequest(cookie), 'verified-state')).toBe(
    channelId,
  )
  expect(
    getOAuthPopupChannel(cookieRequest(cookie), 'another-state'),
  ).toBeNull()
})
it('supports exact legacy popup mode while rejecting malformed cookies', () => {
  expect(isOAuthPopupMode(cookieRequest(createOAuthPopupCookie(false)))).toBe(
    true,
  )
  expect(
    getOAuthPopupChannel(cookieRequest('oauth_popup=1'), 'state'),
  ).toBeNull()
  for (const value of [
    '10',
    '%',
    '%7B',
    encodeURIComponent(JSON.stringify({ state: 'state', channel: 'invalid' })),
  ])
    expect(isOAuthPopupMode(cookieRequest('oauth_popup=' + value))).toBe(false)
})

class TestChannel extends EventTarget {
  static instances: TestChannel[] = []
  close = vi.fn()
  constructor(readonly name: string) {
    super()
    TestChannel.instances.push(this)
  }
}
let page: EventTarget
beforeEach(() => {
  vi.useFakeTimers()
  page = new EventTarget()
  vi.stubGlobal('window', {
    location: { origin: 'https://tanstack.com' },
    addEventListener: page.addEventListener.bind(page),
    removeEventListener: page.removeEventListener.bind(page),
  })
  TestChannel.instances = []
  vi.stubGlobal('BroadcastChannel', TestChannel)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const message = (channel: string) => ({
  type: 'TANSTACK_AUTH_SUCCESS',
  channel,
})
const flush = async () => {
  await vi.dynamicImportSettled()
  await Promise.resolve()
  await Promise.resolve()
}
it('completes through the channel without an opener only after server session verification', async () => {
  const verifySession = vi.fn(async () => true),
    onSuccess = vi.fn()
  const attempt = createOAuthPopupAttempt({ verifySession, onSuccess })
  const channel = TestChannel.instances[0]
  expect(channel.name).toBe(oauthPopupChannelName(attempt.channelId))
  channel.dispatchEvent(
    new MessageEvent('message', { data: message(attempt.channelId) }),
  )
  await flush()
  expect(verifySession).toHaveBeenCalledOnce()
  expect(onSuccess).toHaveBeenCalledOnce()
  expect(channel.close).toHaveBeenCalledOnce()
})
it('rejects wrong origins, wrong attempts, and unbound completion signals', async () => {
  const verifySession = vi.fn(async () => true),
    onSuccess = vi.fn()
  const attempt = createOAuthPopupAttempt({ verifySession, onSuccess })
  page.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://other.example',
      data: message(attempt.channelId),
    }),
  )
  page.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://tanstack.com',
      data: message(channelId),
    }),
  )
  TestChannel.instances[0].dispatchEvent(
    new MessageEvent('message', { data: { type: 'TANSTACK_AUTH_SUCCESS' } }),
  )
  await flush()
  expect(verifySession).not.toHaveBeenCalled()
  expect(onSuccess).not.toHaveBeenCalled()
  attempt.dispose()
})
it('deduplicates channel and opener messages and does not close without a session', async () => {
  const verifySession = vi.fn(async () => false),
    onSuccess = vi.fn()
  const attempt = createOAuthPopupAttempt({ verifySession, onSuccess })
  const data = message(attempt.channelId)
  TestChannel.instances[0].dispatchEvent(new MessageEvent('message', { data }))
  page.dispatchEvent(
    new MessageEvent('message', { origin: 'https://tanstack.com', data }),
  )
  await flush()
  expect(verifySession).toHaveBeenCalledOnce()
  expect(onSuccess).not.toHaveBeenCalled()
  attempt.dispose()
})
it('cancels in-flight verification and ignores the old channel after a retry', async () => {
  let resolve!: (value: boolean) => void
  const verifySession = vi.fn(
    () =>
      new Promise<boolean>((done) => {
        resolve = done
      }),
  )
  const onSuccess = vi.fn()
  const first = createOAuthPopupAttempt({ verifySession, onSuccess })
  TestChannel.instances[0].dispatchEvent(
    new MessageEvent('message', { data: message(first.channelId) }),
  )
  await flush()
  expect(verifySession).toHaveBeenCalledOnce()
  first.dispose()
  const second = createOAuthPopupAttempt({
    verifySession: async () => true,
    onSuccess,
  })
  resolve(true)
  await flush()
  expect(onSuccess).not.toHaveBeenCalled()
  page.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://tanstack.com',
      data: message(first.channelId),
    }),
  )
  await flush()
  expect(onSuccess).not.toHaveBeenCalled()
  TestChannel.instances[1].dispatchEvent(
    new MessageEvent('message', { data: message(second.channelId) }),
  )
  await flush()
  expect(onSuccess).toHaveBeenCalledOnce()
})
it('cleans up after the OAuth cookie lifetime without polling popup.closed', async () => {
  const verifySession = vi.fn(async () => true),
    onSuccess = vi.fn()
  const attempt = createOAuthPopupAttempt({ verifySession, onSuccess })
  await vi.advanceTimersByTimeAsync(600000)
  page.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://tanstack.com',
      data: message(attempt.channelId),
    }),
  )
  await flush()
  expect(verifySession).not.toHaveBeenCalled()
  expect(TestChannel.instances[0].close).toHaveBeenCalledOnce()
})
