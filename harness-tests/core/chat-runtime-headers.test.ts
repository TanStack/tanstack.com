const access = vi.hoisted(() => vi.fn())
vi.mock('../../src/chat/access.functions', () => ({ getChatAccess: access }))
import { expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => {
  const headers: (() => Record<string, string>)[] = []
  const beforeLoads: ((input: {
    cause: 'enter' | 'stay' | 'preload'
  }) => Promise<void>)[] = []
  return { headers, beforeLoads }
})
vi.mock('../../src/chat/components/ChatShell', () => ({
  ChatShell: () => null,
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({ handler: () => () => null }),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    () =>
    (options: {
      headers: () => Record<string, string>
      beforeLoad: (input: {
        cause: 'enter' | 'stay' | 'preload'
      }) => Promise<void>
    }) => {
      captured.headers.push(options.headers)
      captured.beforeLoads.push(options.beforeLoad)
      return options
    },
}))

it('isolates authenticated chat for browser execution without caching private documents', async () => {
  await import('../../src/routes/chat')
  expect(captured.headers).toHaveLength(1)
  expect(captured.headers[0]()).toEqual({
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cache-Control': 'private, no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
  })
})

it('checks access on entry without blocking navigation within the chat shell', async () => {
  await import('../../src/routes/chat')
  access.mockResolvedValue({ unlocked: true })
  await captured.beforeLoads[0]({ cause: 'enter' })
  await captured.beforeLoads[0]({ cause: 'stay' })
  await captured.beforeLoads[0]({ cause: 'stay' })
  expect(access).toHaveBeenCalledOnce()
})
