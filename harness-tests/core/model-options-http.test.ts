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
  catalog: vi.fn(),
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
  getRunModelCatalog: m.catalog,
  RunModelError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message)
    }
  },
}))
import { handleModelOptions } from '../../src/chat/server/model-options-http.server'
const url = 'https://tanstack.com/api/chat/model-options?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowedProviders: ['included'] })
  m.env.mockResolvedValue({ INCLUDED_MODEL: 'configured' })
  m.catalog.mockResolvedValue({ choices: [] })
})
it('uses server account and workspace policy with live configuration', async () => {
  expect(
    (await handleModelOptions(new Request(url + '&fixture=true&userId=other')))
      .status,
  ).toBe(200)
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.catalog).toHaveBeenCalledWith(
    { INCLUDED_MODEL: 'configured' },
    {
      userId: 'owner',
      policy: { allowedProviders: ['included'] },
      fixture: false,
    },
  )
})
it('denies signed-out accounts before reading provider configuration', async () => {
  m.user.mockResolvedValue(null)
  expect((await handleModelOptions(new Request(url))).status).toBe(401)
  expect(m.env).not.toHaveBeenCalled()
})
it('does not read provider credentials after workspace access rejection', async () => {
  const { WorkspacePolicyError } =
    await import('../../src/chat/workspace-policy.server')
  m.policy.mockRejectedValue(new WorkspacePolicyError())
  expect((await handleModelOptions(new Request(url))).status).toBe(403)
  expect(m.env).not.toHaveBeenCalled()
  expect(m.catalog).not.toHaveBeenCalled()
})
it('preserves model configuration errors', async () => {
  const { RunModelError } = await import('../../src/chat/server/run-models')
  m.env.mockRejectedValue(new RunModelError('Not configured', 503))
  expect((await handleModelOptions(new Request(url))).status).toBe(503)
})
