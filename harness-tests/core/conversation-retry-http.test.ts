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
  identity: vi.fn(),
  runtime: vi.fn(),
  mcp: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  prepare: vi.fn(),
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
vi.mock('../../src/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: m.identity,
  ConversationIdentityError: class extends Error {
    status = 404
  },
}))
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.mcp,
  McpEnvironmentError: class extends Error {
    status = 503
  },
}))
vi.mock('../../src/chat/server/conversation-retries', () => ({
  ConversationRetries: class {
    create = m.create
    get = m.get
    prepare = m.prepare
  },
}))
import { handleConversationRetry } from '../../src/chat/server/conversation-retry-http.server'
const url =
  'https://tanstack.com/api/chat/retries/receipt?workspaceId=workspace'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ models: ['included'] })
  m.identity.mockResolvedValue({ botId: 'bot', conversationId: 'authorized' })
  m.runtime.mockResolvedValue({
    KODY_ORIGIN: 'https://kody.codes',
    CONVERSATIONS: { getByName: vi.fn() },
    FILES: { get: vi.fn(), put: vi.fn(), head: vi.fn() },
  })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.get.mockResolvedValue({ status: 'preparing' })
  m.prepare.mockResolvedValue({ status: 'ready' })
  m.create.mockResolvedValue({ status: 'preparing' })
})
it('polls the original receipt without advancing preparation or creating work', async () => {
  expect(
    (await handleConversationRetry(new Request(url), id, 'get')).status,
  ).toBe(202)
  expect(m.get).toHaveBeenCalledWith(id)
  expect(m.prepare).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
  expect(m.identity).not.toHaveBeenCalled()
})
it('prepares only on explicit POST with server policy and live mode', async () => {
  expect(
    (
      await handleConversationRetry(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
        }),
        id,
        'prepare',
      )
    ).status,
  ).toBe(200)
  expect(m.prepare).toHaveBeenCalledWith(id, {
    policy: { models: ['included'] },
    fixture: false,
  })
  expect(m.create).not.toHaveBeenCalled()
})
it('creates using authorized conversation identity and original request payload', async () => {
  const input = { idempotencyKey: id, messageId: 'message' }
  expect(
    (
      await handleConversationRetry(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify(input),
        }),
        'parent',
        'create',
      )
    ).status,
  ).toBe(202)
  expect(m.create).toHaveBeenCalledWith(
    { botId: 'bot', conversationId: 'authorized' },
    input,
    { policy: { models: ['included'] }, fixture: false },
  )
  expect(m.identity).toHaveBeenCalledWith({
    workspaceId: 'workspace',
    userId: 'owner',
    conversationId: 'parent',
  })
})
it('denies cross-origin preparation before account lookup', async () => {
  expect(
    (
      await handleConversationRetry(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        }),
        id,
        'prepare',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.prepare).not.toHaveBeenCalled()
})
