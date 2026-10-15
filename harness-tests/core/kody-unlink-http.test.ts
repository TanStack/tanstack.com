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
  read: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  where: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/db/client', () => ({ db: { delete: m.remove } }))
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.env,
  McpEnvironmentError: class extends Error {
    status = 503
  },
}))
vi.mock('../../src/chat/server/credentials', () => ({
  readCredentials: m.read,
  updateCredentials: m.update,
}))
import { handleKodyUnlink } from '../../src/chat/server/kody-unlink-http.server'
function request(origin = 'https://tanstack.com') {
  return new Request(
    'https://tanstack.com/api/chat/kody/unlink?userId=forged',
    { method: 'POST', headers: { Origin: origin } },
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.env.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.read.mockResolvedValue({ kody: { access_token: 'secret' } })
  m.remove.mockReturnValue({ where: m.where })
  m.where.mockResolvedValue(undefined)
})
it('removes only the integration credentials for the signed-in account', async () => {
  expect(await (await handleKodyUnlink(request())).json()).toEqual({
    connected: false,
  })
  expect(m.read).toHaveBeenCalledWith({ ENCRYPTION_KEY: 'key' }, 'owner')
  expect(m.update).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key' },
    'owner',
    expect.any(Function),
  )
  const change = m.update.mock.calls[0][2]
  expect(
    change({
      kody: { access_token: 'secret' },
      connection: { provider: 'included' },
      other: 'preserved',
    }),
  ).toEqual({ connection: { provider: 'included' }, other: 'preserved' })
  expect(m.where).toHaveBeenCalled()
})
it('keeps credential removal idempotent when already disconnected', async () => {
  m.read.mockResolvedValue({ connection: { provider: 'included' } })
  expect((await handleKodyUnlink(request())).status).toBe(200)
  expect(m.update).not.toHaveBeenCalled()
  expect(m.where).toHaveBeenCalled()
})
it('rejects cross-origin unlink before reading identity or credentials', async () => {
  expect(
    (await handleKodyUnlink(request('https://other.example'))).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.read).not.toHaveBeenCalled()
  expect(m.remove).not.toHaveBeenCalled()
})
it('rejects unsigned account unlink', async () => {
  m.user.mockResolvedValue(null)
  expect((await handleKodyUnlink(request())).status).toBe(401)
  expect(m.update).not.toHaveBeenCalled()
  expect(m.remove).not.toHaveBeenCalled()
})
