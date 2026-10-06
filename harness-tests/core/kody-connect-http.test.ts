// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  env: vi.fn(),
  host: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  pending: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({ getHostRuntimeEnv: m.host }))
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.env,
}))
vi.mock('../../src/chat/server/kody-oauth-store', () => ({
  readKodyOauthClient: m.read,
  saveKodyOauthClient: m.save,
  saveKodyOauthPending: m.pending,
}))
import { handleKodyConnect } from '../../src/chat/server/kody-connect-http.server'
import { unseal } from '../../src/chat/server/crypto'
const key = 'a'.repeat(32)
function request(origin = 'https://tanstack.com') {
  return new Request(
    'https://tanstack.com/api/chat/kody/connect?popup=1&userId=forged',
    { method: 'POST', headers: { Origin: origin } },
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.env.mockResolvedValue({ ENCRYPTION_KEY: key })
  m.host.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
  m.read.mockResolvedValue('registered-client')
})
it('rejects cross-origin before reading identity', async () => {
  expect(
    (await handleKodyConnect(request('https://other.example'))).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
})
it('requires the shared signed-in identity', async () => {
  m.user.mockResolvedValue(null)
  expect((await handleKodyConnect(request())).status).toBe(401)
  expect(m.pending).not.toHaveBeenCalled()
})
it('binds encrypted PKCE state to the shared account and retains normal 2FA login', async () => {
  const response = await handleKodyConnect(request())
  expect(response.status).toBe(302)
  const location = new URL(response.headers.get('Location')!)
  expect(location.pathname).toBe('/login')
  const authorize = new URL(
    location.searchParams.get('redirectTo')!,
    'https://kody.codes',
  )
  expect(authorize.pathname).toBe('/oauth/authorize')
  expect(authorize.searchParams.get('redirect_uri')).toBe(
    'https://tanstack.com/api/chat/kody/callback',
  )
  const pending = m.pending.mock.calls[0][0]
  expect(pending.userId).toBe('owner')
  expect(await unseal(pending.payload, key)).toMatchObject({
    userId: 'owner',
    mode: 'connect',
    popup: true,
    clientId: 'registered-client',
  })
  expect(response.headers.get('Set-Cookie')).toContain(
    'HttpOnly; SameSite=Lax; Max-Age=600; Secure',
  )
})
