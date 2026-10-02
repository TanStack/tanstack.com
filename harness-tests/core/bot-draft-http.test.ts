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
  get: vi.fn(),
  start: vi.fn(),
  actions: vi.fn(),
  model: vi.fn(),
  mcp: vi.fn(),
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
vi.mock('../../src/chat/server/bot-drafts', () => ({
  BotDrafts: class {
    get = m.get
  },
  BotDraftError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/bot-draft-start', () => ({
  startBotDraft: m.start,
}))
vi.mock('../../src/chat/server/saved-actions', () => ({
  SavedActions: class {
    list = m.actions
  },
}))
vi.mock('../../src/chat/server/model-environment.server', () => ({
  getModelEnvironment: m.model,
}))
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.mcp,
  McpEnvironmentError: class extends Error {
    status = 503
  },
}))
import { handleBotDraft } from '../../src/chat/server/bot-draft-http.server'
const url =
  'https://tanstack.com/api/chat/bot-drafts/draft?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowChatModels: true })
  m.runtime.mockResolvedValue({
    FILES: { get: vi.fn(), put: vi.fn(), head: vi.fn() },
    CONVERSATIONS: { getByName: vi.fn() },
    KODY_ORIGIN: 'https://kody.codes',
  })
  m.model.mockResolvedValue({
    INCLUDED_MODEL: 'configured',
    ENCRYPTION_KEY: 'test',
  })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'test' })
  m.actions.mockResolvedValue([])
  m.start.mockResolvedValue({ started: true })
  m.get.mockResolvedValue(null)
})
it('starts using server account, policy and origin rather than caller context', async () => {
  const body = { text: 'Hello', userId: 'attacker', fixture: true }
  const response = await handleBotDraft(
    new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
    'draft',
  )
  expect(response.status).toBe(200)
  expect(m.start.mock.calls[0].slice(1)).toEqual([
    'workspace',
    'owner',
    'draft',
    body,
    {
      policy: { allowChatModels: true },
      recipes: [],
      fixture: false,
      appOrigin: 'https://tanstack.com',
    },
  ])
  expect(m.actions).toHaveBeenCalledWith(true)
})
it('reads draft receipts without resolving model or integration credentials', async () => {
  expect(
    await (await handleBotDraft(new Request(url), 'draft')).json(),
  ).toBeNull()
  expect(m.get).toHaveBeenCalledWith('draft')
  expect(m.model).not.toHaveBeenCalled()
  expect(m.mcp).not.toHaveBeenCalled()
})
it('denies cross-origin first messages before account lookup', async () => {
  expect(
    (
      await handleBotDraft(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
        'draft',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.start).not.toHaveBeenCalled()
})
