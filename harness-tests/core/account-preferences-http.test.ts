// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: mocks.user }),
}))
vi.mock('../../src/chat/server/account-preferences', () => ({
  readAccountPreferences: mocks.read,
  updateAccountPreferences: mocks.update,
  AccountPreferencesError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))
import { handleAccountPreferences } from '../../src/chat/server/account-preferences-http.server'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({
    userId: 'signed-in',
    capabilities: ['builder'],
  })
  mocks.read.mockResolvedValue({ revision: 1 })
  mocks.update.mockResolvedValue({ revision: 2 })
})
it('uses the session account instead of a query account', async () => {
  const response = await handleAccountPreferences(
    new Request(
      'https://tanstack.com/api/chat/account/preferences?userId=someone-else',
    ),
  )
  expect(response.status).toBe(200)
  expect(mocks.read).toHaveBeenCalledWith('signed-in')
})
it('denies signed-out reads before touching preference storage', async () => {
  mocks.user.mockResolvedValue(null)
  expect(
    (
      await handleAccountPreferences(
        new Request('https://tanstack.com/api/chat/account/preferences'),
      )
    ).status,
  ).toBe(401)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('denies cross-origin writes before touching the account', async () => {
  const response = await handleAccountPreferences(
    new Request('https://tanstack.com/api/chat/account/preferences', {
      method: 'POST',
      headers: { Origin: 'https://elsewhere.example' },
      body: '{}',
    }),
  )
  expect(response.status).toBe(403)
  expect(mocks.user).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})
it('passes bounded JSON to the service with the authenticated account', async () => {
  const body = { timezone: 'America/Denver', revision: 1 }
  const response = await handleAccountPreferences(
    new Request('https://tanstack.com/api/chat/account/preferences', {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
  )
  expect(response.status).toBe(200)
  expect(mocks.update).toHaveBeenCalledWith('signed-in', body)
})

it('returns preference revision conflicts without masking them', async () => {
  const { AccountPreferencesError } =
    await import('../../src/chat/server/account-preferences')
  mocks.update.mockRejectedValue(new AccountPreferencesError('Changed', 409))
  const response = await handleAccountPreferences(
    new Request('https://tanstack.com/api/chat/account/preferences', {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify({ revision: 1 }),
    }),
  )
  expect(response.status).toBe(409)
})
