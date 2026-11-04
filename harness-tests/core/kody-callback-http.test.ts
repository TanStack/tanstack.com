// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: vi.fn(), host: vi.fn(), consume: vi.fn() }))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({ getHostRuntimeEnv: m.host }))
vi.mock('~/db/client', () => ({ db: {} }))
vi.mock('../../src/chat/server/kody-oauth-store', () => ({
  consumeKodyOauthPending: m.consume,
}))
import { handleKodyCallback } from '../../src/chat/server/kody-callback-http.server'
function request(cookie = 'state', issuer = 'https://kody.codes') {
  const url = new URL('https://tanstack.com/api/chat/kody/callback')
  url.search = new URLSearchParams({
    state: 'state',
    code: 'code',
    iss: issuer,
  }).toString()
  return new Request(url, {
    headers: { Cookie: `tanchat_kody_oauth=${cookie}` },
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.host.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
  m.consume.mockResolvedValue(undefined)
})
it('requires shared auth before consuming state', async () => {
  m.user.mockResolvedValue(null)
  expect((await handleKodyCallback(request())).status).toBe(401)
  expect(m.consume).not.toHaveBeenCalled()
})
it('rejects a mismatched browser state', async () => {
  expect((await handleKodyCallback(request('other'))).status).toBe(400)
  expect(m.consume).not.toHaveBeenCalled()
})
it('rejects a different authorization issuer', async () => {
  expect(
    (await handleKodyCallback(request('state', 'https://other.example')))
      .status,
  ).toBe(400)
  expect(m.consume).not.toHaveBeenCalled()
})
it('consumes state only for the shared account and rejects expiry', async () => {
  expect((await handleKodyCallback(request())).status).toBe(400)
  expect(m.consume).toHaveBeenCalledWith(expect.any(String), 'owner')
})
