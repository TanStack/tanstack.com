// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  account: vi.fn(),
  transport: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('../../src/chat/server/connected-devices', () => ({
  deviceAccountApi: m.account,
  deviceTransportApi: m.transport,
}))
import {
  handleDeviceAccount,
  handleDeviceTransport,
} from '../../src/chat/server/device-http.server'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.account.mockResolvedValue(Response.json([]))
  m.transport.mockResolvedValue(Response.json(null))
})
it('supplies shared signed-in account identity', async () => {
  const request = new Request(
    'https://tanstack.com/api/chat/account/devices?userId=forged',
  )
  expect((await handleDeviceAccount(request)).status).toBe(200)
  expect(m.account).toHaveBeenCalledWith(request, 'owner')
})
it('rejects cross-origin device changes before authentication', async () => {
  expect(
    (
      await handleDeviceAccount(
        new Request('https://tanstack.com/api/chat/account/devices', {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        }),
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.account).not.toHaveBeenCalled()
})
it('keeps device bearer transport separate from user sessions', async () => {
  const request = new Request(
    'https://tanstack.com/api/chat/device-transport',
    { method: 'POST', headers: { Authorization: 'Bearer test' } },
  )
  expect((await handleDeviceTransport(request)).status).toBe(200)
  expect(m.transport).toHaveBeenCalledWith(request)
  expect(m.user).not.toHaveBeenCalled()
})
