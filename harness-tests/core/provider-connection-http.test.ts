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
  env: vi.fn(),
  save: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/model-environment.server', () => ({
  getModelEnvironment: m.env,
}))
vi.mock('../../src/chat/server/run-models', () => ({
  RunModelError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message)
    }
  },
}))
vi.mock('../../src/chat/server/provider-connection', () => ({
  saveProviderConnection: m.save,
}))
import { handleProviderConnection } from '../../src/chat/server/provider-connection-http.server'
const url = 'https://tanstack.com/api/chat/connection?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowedProviders: ['included'] })
  m.env.mockResolvedValue({ INCLUDED_MODEL: 'configured' })
  m.save.mockResolvedValue({ ok: true })
})
const request = () =>
  new Request(url + '&userId=other', {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({
      provider: 'included',
      model: 'configured',
      userId: 'attacker',
    }),
  })
it('uses the session owner and authorized policy for credential updates', async () => {
  expect((await handleProviderConnection(request())).status).toBe(200)
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.save).toHaveBeenCalledWith(
    { INCLUDED_MODEL: 'configured' },
    'owner',
    { allowedProviders: ['included'] },
    { provider: 'included', model: 'configured', userId: 'attacker' },
  )
})
it('denies signed-out accounts before reading provider configuration', async () => {
  m.user.mockResolvedValue(null)
  expect((await handleProviderConnection(request())).status).toBe(401)
  expect(m.env).not.toHaveBeenCalled()
})
it('does not read provider credentials after workspace access rejection', async () => {
  const { WorkspacePolicyError } =
    await import('../../src/chat/workspace-policy.server')
  m.policy.mockRejectedValue(new WorkspacePolicyError())
  expect((await handleProviderConnection(request())).status).toBe(403)
  expect(m.env).not.toHaveBeenCalled()
  expect(m.save).not.toHaveBeenCalled()
})
it('preserves model configuration errors', async () => {
  const { RunModelError } = await import('../../src/chat/server/run-models')
  m.env.mockRejectedValue(new RunModelError('Not configured', 503))
  expect((await handleProviderConnection(request())).status).toBe(503)
})

it('denies cross-origin provider changes before authentication', async () => {
  expect(
    (
      await handleProviderConnection(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://elsewhere.example' },
          body: '{}',
        }),
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.save).not.toHaveBeenCalled()
})
