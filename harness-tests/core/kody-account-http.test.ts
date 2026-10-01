// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  runtime: vi.fn(),
  mcp: vi.fn(),
  account: vi.fn(),
  sync: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: m.runtime,
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.mcp,
  McpEnvironmentError: class extends Error {
    status = 503
  },
}))
vi.mock('../../src/chat/server/kody-account', () => ({
  readKodyAccount: m.account,
}))
vi.mock('../../src/chat/server/kody-sync', () => ({ syncKodyAccount: m.sync }))
import { handleKodyAccount } from '../../src/chat/server/kody-account-http.server'
const url = 'https://tanstack.com/api/chat/kody/account?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowKody: true })
  m.runtime.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.account.mockResolvedValue({ status: 'connected' })
  m.sync.mockResolvedValue(true)
})
it('reads account with signed-in identity and bounded cancellation', async () => {
  expect(
    await (
      await handleKodyAccount(new Request(url + '&userId=other'), 'account')
    ).json(),
  ).toEqual({ status: 'connected' })
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.account).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key', KODY_ORIGIN: 'https://kody.codes' },
    'owner',
    'workspace',
    expect.any(AbortSignal),
  )
})
it('retains policy denial before account configuration or network access', async () => {
  m.policy.mockResolvedValue({ allowKody: false })
  expect((await handleKodyAccount(new Request(url), 'account')).status).toBe(
    403,
  )
  expect(m.runtime).not.toHaveBeenCalled()
  expect(m.account).not.toHaveBeenCalled()
})
it('syncs using server-owned policy and live mode', async () => {
  expect(
    await (
      await handleKodyAccount(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: '{"fixture":true}',
        }),
        'sync',
      )
    ).json(),
  ).toEqual({ changed: true })
  expect(m.sync).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key', KODY_ORIGIN: 'https://kody.codes' },
    { workspaceId: 'workspace', userId: 'owner' },
    { policy: { allowKody: true }, fixture: false },
  )
})
it('denies cross-origin sync before reading the account', async () => {
  expect(
    (
      await handleKodyAccount(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        }),
        'sync',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.sync).not.toHaveBeenCalled()
})
