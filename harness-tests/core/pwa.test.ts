import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { expect, it, vi } from 'vitest'

it('advertises installable same-origin entry points and real icons', () => {
  const manifest = JSON.parse(
    readFileSync('public/chat/manifest.webmanifest', 'utf8'),
  )
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/chat')
  expect(manifest.scope).toBe('/chat')
  expect(manifest.id).toBe('/chat')
  for (const icon of manifest.icons) {
    const bytes = readFileSync(`public${icon.src}`)
    expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    const [width, height] = icon.sizes.split('x').map(Number)
    expect(bytes.readUInt32BE(16)).toBe(width)
    expect(bytes.readUInt32BE(20)).toBe(height)
  }
})
type WorkerFetchEvent = {
  request: { method: string; mode: string; url: string }
  respondWith: (response: Promise<Response>) => void
}
function worker(online: boolean) {
  const events = new Map<string, (event: WorkerFetchEvent) => void>()
  const fallback = new Response('offline')
  const fetch = vi.fn(() =>
    online
      ? Promise.resolve(new Response('live'))
      : Promise.reject(new Error('offline')),
  )
  const match = vi.fn(async () => fallback)
  vm.runInNewContext(readFileSync('public/tanchat-sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://app.test' },
      addEventListener: (
        name: string,
        handler: (event: WorkerFetchEvent) => void,
      ) => events.set(name, handler),
    },
    URL,
    Response,
    fetch,
    caches: { match },
  })
  return { handle: events.get('fetch')!, match, fetch }
}
it.each([
  '/',
  '/builder',
  '/chatty/private',
  '/api/chat/bootstrap',
  '/api/bootstrap',
  '/auth/callback?code=private',
  '/auth/email/verify',
])('does not intercept account or authentication requests: %s', (path) => {
  const w = worker(false),
    respondWith = vi.fn()
  w.handle({
    request: {
      method: 'GET',
      mode: 'navigate',
      url: `https://app.test${path}`,
    },
    respondWith,
  })
  expect(respondWith).not.toHaveBeenCalled()
  expect(w.match).not.toHaveBeenCalled()
})
it('never replays a mutation or intercepts third-party navigation', () => {
  const w = worker(false),
    respondWith = vi.fn()
  for (const [method, url] of [
    ['POST', 'https://app.test/chat/w/test'],
    ['GET', 'https://other.test/'],
  ]) {
    w.handle({ request: { method, mode: 'navigate', url }, respondWith })
  }
  expect(respondWith).not.toHaveBeenCalled()
})
it.each([true, false])(
  'uses fresh navigation online and a public fallback offline (%s)',
  async (online) => {
    const w = worker(online)
    let result!: Promise<Response>
    w.handle({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: 'https://app.test/chat/w/private',
      },
      respondWith: (response: Promise<Response>) => {
        result = response
      },
    })
    expect(await (await result).text()).toBe(online ? 'live' : 'offline')
    expect(w.match).toHaveBeenCalledTimes(online ? 0 : 1)
  },
)

it('handles the exact chat entry offline without intercepting subresource requests', async () => {
  const w = worker(false)
  let result: Promise<Response> | undefined
  w.handle({
    request: { method: 'GET', mode: 'navigate', url: 'https://app.test/chat' },
    respondWith: (response: Promise<Response>) => {
      result = response
    },
  })
  expect(result).toBeDefined()
  expect(await (await result!).text()).toBe('offline')
  const respondWith = vi.fn()
  w.handle({
    request: {
      method: 'GET',
      mode: 'cors',
      url: 'https://app.test/chat/private.json',
    },
    respondWith,
  })
  expect(respondWith).not.toHaveBeenCalled()
})
