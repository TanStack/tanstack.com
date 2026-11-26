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
  source: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
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
vi.mock('../../src/chat/server/conversation-copies', () => ({
  ConversationCopies: class {
    getCopySource = m.source
    create = m.create
    get = m.get
  },
}))
import { handleConversationCopy } from '../../src/chat/server/conversation-copy-http.server'
const url =
  'https://tanstack.com/api/chat/conversations/parent/copies?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.identity.mockResolvedValue({ botId: 'bot', conversationId: 'authorized' })
  m.runtime.mockResolvedValue({ CONVERSATIONS: { getByName: vi.fn() } })
})
it('retains source status and immutable conversation copy identity', async () => {
  const body = { idempotencyKey: 'receipt', kind: 'fork' }
  for (const [status, http] of [
    ['copying', 202],
    ['ready', 201],
    ['failed', 200],
  ]) {
    m.create.mockResolvedValue({ status })
    expect(
      (
        await handleConversationCopy(
          new Request(url, {
            method: 'POST',
            headers: { Origin: 'https://tanstack.com' },
            body: JSON.stringify(body),
          }),
          'parent',
          'conversation',
        )
      ).status,
    ).toBe(http)
  }
  expect(m.create).toHaveBeenCalledWith('bot', body, 'authorized')
})
it('reads copy status without creating or submitting work', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  m.get.mockResolvedValue({ operationId: id, status: 'copying' })
  expect(
    (await handleConversationCopy(new Request(url), id, 'operation')).status,
  ).toBe(200)
  expect(m.get).toHaveBeenCalledWith(id)
  expect(m.create).not.toHaveBeenCalled()
  expect(m.identity).not.toHaveBeenCalled()
})
it('denies cross-origin creation before account lookup', async () => {
  expect(
    (
      await handleConversationCopy(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
        'parent',
        'conversation',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})

it('reads original copy origin without resubmitting copy work', async () => {
  m.source.mockResolvedValue({ sourceConversationId: 'original' })
  expect(
    await (
      await handleConversationCopy(
        new Request(url),
        'child',
        'conversation',
        true,
      )
    ).json(),
  ).toEqual({ sourceConversationId: 'original' })
  expect(m.source).toHaveBeenCalledWith('bot', 'authorized')
  expect(m.create).not.toHaveBeenCalled()
})
