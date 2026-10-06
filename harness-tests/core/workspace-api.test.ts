import { afterEach, expect, it, vi } from 'vitest'
import { workspaceApi } from '../../src/chat/components/WorkspaceApi'
afterEach(() => vi.unstubAllGlobals())
it('preserves request query and opaque workspace IDs in the chat namespace', () => {
  expect(
    workspaceApi('personal:user+value').url(
      'conversations/id/stream?offset=123&live=sse',
    ),
  ).toBe(
    '/api/chat/conversations/id/stream?offset=123&live=sse&workspaceId=personal%3Auser%2Bvalue',
  )
  expect(workspaceApi().url('account/onboarding')).toBe(
    '/api/chat/account/onboarding',
  )
})
it('uses the same scoped URL for fetch and streaming callers', async () => {
  const fetch = vi.fn(async () => Response.json({ ok: true }))
  vi.stubGlobal('fetch', fetch)
  const api = workspaceApi('workspace')
  await api.request('conversations/id/send', { text: 'hello' })
  expect(fetch).toHaveBeenCalledWith(
    api.url('conversations/id/send'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    }),
  )
})
