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
vi.mock('../../src/chat/server/onboarding', () => ({
  readOnboarding: mocks.read,
  updateOnboarding: mocks.update,
  OnboardingError: class extends Error {
    status = 409
  },
}))
import { handleOnboarding } from '../../src/chat/server/onboarding-http.server'
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
  const response = await handleOnboarding(
    new Request(
      'https://tanstack.com/api/chat/account/onboarding?userId=someone-else',
    ),
  )
  expect(response.status).toBe(200)
  expect(mocks.read).toHaveBeenCalledWith('signed-in')
})
it('denies signed-out reads before touching onboarding storage', async () => {
  mocks.user.mockResolvedValue(null)
  expect(
    (
      await handleOnboarding(
        new Request('https://tanstack.com/api/chat/account/onboarding'),
      )
    ).status,
  ).toBe(401)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('denies cross-origin writes before touching the account', async () => {
  const response = await handleOnboarding(
    new Request('https://tanstack.com/api/chat/account/onboarding', {
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
  const body = { action: 'skip', revision: 1, commandId: 'command' }
  const response = await handleOnboarding(
    new Request('https://tanstack.com/api/chat/account/onboarding', {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
  )
  expect(response.status).toBe(200)
  expect(mocks.update).toHaveBeenCalledWith('signed-in', body)
})
