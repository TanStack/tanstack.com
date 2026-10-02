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
  identity: vi.fn(),
  list: vi.fn(),
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
vi.mock('../../src/chat/server/message-references', () => ({
  listMessageReferences: m.list,
  ReferenceError: class extends Error {
    status = 400
  },
}))
import { handleReferences } from '../../src/chat/server/reference-http.server'
const url =
  'https://tanstack.com/api/chat/references?workspaceId=workspace&kind=all&query=work'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowKody: true })
  m.runtime.mockResolvedValue({
    KODY_ORIGIN: 'https://kody.codes',
    FILES: { put: vi.fn(), head: vi.fn(), get: vi.fn() },
    CONVERSATIONS: { getByName: vi.fn() },
  })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.list.mockResolvedValue({ items: [] })
  m.identity.mockResolvedValue({
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
    conversationId: 'thread',
  })
})
it('uses session-owned workspace scope and original filters', async () => {
  expect(
    (
      await handleReferences(
        new Request(url + '&userId=forged&excludeBotId=excluded'),
      )
    ).status,
  ).toBe(200)
  expect(m.list).toHaveBeenCalledWith(
    expect.any(Object),
    { workspaceId: 'workspace', userId: 'owner', botId: 'excluded' },
    { kind: 'all', query: 'work', policy: { allowKody: true }, fixture: false },
  )
})
it('resolves conversation ownership before lookup', async () => {
  await handleReferences(new Request(url), 'thread')
  expect(m.identity).toHaveBeenCalledWith({
    workspaceId: 'workspace',
    userId: 'owner',
    conversationId: 'thread',
  })
  expect(m.list).toHaveBeenCalledWith(
    expect.any(Object),
    {
      workspaceId: 'workspace',
      userId: 'owner',
      botId: 'bot',
      conversationId: 'thread',
    },
    expect.any(Object),
  )
})
it('rejects duplicate workspace selectors', async () => {
  expect(
    (await handleReferences(new Request(url + '&workspaceId=other'))).status,
  ).toBe(400)
  expect(m.policy).not.toHaveBeenCalled()
  expect(m.list).not.toHaveBeenCalled()
})
it('rejects unsupported kinds without catalog reads', async () => {
  expect(
    (
      await handleReferences(
        new Request(url.replace('kind=all', 'kind=invalid')),
      )
    ).status,
  ).toBe(400)
  expect(m.list).not.toHaveBeenCalled()
})
