import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'
it('handles only chat navigation and never caches authenticated responses', async () => {
  type FetchHandler = (event: {
    request: { method: string; mode: string; url: string }
    respondWith: (response: Promise<unknown>) => void
  }) => void
  const handlers = new Map<string, FetchHandler>()
  const match = vi.fn().mockResolvedValue('offline-page')
  const fetch = vi.fn().mockRejectedValue(new Error('offline'))
  runInNewContext(readFileSync('public/tanchat-sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://tanstack.com' },
      addEventListener: (name: string, handler: FetchHandler) =>
        handlers.set(name, handler),
    },
    caches: { match },
    fetch,
    URL,
    Response,
  })
  for (const pathname of [
    '/api/chat/bootstrap',
    '/auth/signin',
    '/',
    '/docs',
  ]) {
    const respondWith = vi.fn()
    handlers.get('fetch')!({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: `https://tanstack.com${pathname}`,
      },
      respondWith,
    })
    expect(respondWith).not.toHaveBeenCalled()
  }
  for (const pathname of ['/chat', '/chat/w/personal']) {
    const respondWith = vi.fn()
    handlers.get('fetch')!({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: `https://tanstack.com${pathname}`,
      },
      respondWith,
    })
    expect(await respondWith.mock.calls[0][0]).toBe('offline-page')
    expect(match).toHaveBeenCalledWith('/chat/offline.html')
  }
})
