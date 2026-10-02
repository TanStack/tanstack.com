vi.mock('../../src/chat/access.functions', () => ({ getChatAccess: vi.fn() }))
import { expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => {
  const headers: (() => Record<string, string>)[] = []
  return { headers }
})
vi.mock('../../src/chat/components/ChatShell', () => ({
  ChatShell: () => null,
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({ handler: () => () => null }),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    () => (options: { headers: () => Record<string, string> }) => {
      captured.headers.push(options.headers)
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
