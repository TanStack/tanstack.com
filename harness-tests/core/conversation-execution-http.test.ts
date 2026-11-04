// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  identity: vi.fn(),
  runtime: vi.fn(),
  allowed: vi.fn(),
  history: vi.fn(),
  snapshot: vi.fn(),
  events: vi.fn(),
  project: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: m.runtime,
}))
vi.mock('../../src/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: m.identity,
  ConversationIdentityError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/browser-execution', () => ({
  browserExecutionRequestAllowed: m.allowed,
}))
vi.mock('../../src/chat/server/execution-project-snapshots', () => ({
  executionProjectSnapshotApi: m.project,
}))
import { handleConversationExecution } from '../../src/chat/server/conversation-execution-http.server'
const identity = {
  workspaceId: 'workspace',
  userId: 'owner',
  botId: 'bot',
  conversationId: 'conversation',
}
const url =
  'https://tanstack.com/api/chat/conversations/conversation/execution?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.identity.mockResolvedValue(identity)
  m.allowed.mockReturnValue(true)
  m.runtime.mockResolvedValue({
    CONVERSATIONS: {
      getByName: () => ({
        executionHistory: m.history,
        executionSnapshot: m.snapshot,
        executionEvents: m.events,
      }),
    },
    FILES: { get: vi.fn(), put: vi.fn(), head: vi.fn() },
  })
  m.history.mockResolvedValue({ ok: true, history: { sessions: [] } })
})
it('reads original execution history with server-owned identity and workspace query', async () => {
  const response = await handleConversationExecution(
    new Request(url + '&history=1'),
    'conversation',
  )
  expect(await response.json()).toEqual({ sessions: [] })
  expect(m.identity).toHaveBeenCalledWith({
    conversationId: 'conversation',
    workspaceId: 'workspace',
    userId: 'owner',
  })
  expect(m.history).toHaveBeenCalledWith(identity)
})
it('rejects cross-origin commands before looking up a session', async () => {
  expect(
    (
      await handleConversationExecution(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
        'conversation',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.identity).not.toHaveBeenCalled()
})
it('preserves local opt-in restriction before calling execution RPCs', async () => {
  m.allowed.mockReturnValue(false)
  expect(
    (
      await handleConversationExecution(
        new Request(url + '&history=1'),
        'conversation',
      )
    ).status,
  ).toBe(404)
  expect(m.history).not.toHaveBeenCalled()
})
it('passes snapshot responses through unchanged after authorization', async () => {
  const response = new Response('snapshot', {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  m.project.mockResolvedValue(response)
  expect(
    await handleConversationExecution(
      new Request(url),
      'conversation',
      'snapshot',
    ),
  ).toBe(response)
  expect(m.project.mock.calls[0][2]).toEqual(identity)
})
it('rejects unknown output cursor fields without calling execution', async () => {
  expect(
    (
      await handleConversationExecution(
        new Request(url + '&history=1&extra=1'),
        'conversation',
      )
    ).status,
  ).toBe(400)
  expect(m.history).not.toHaveBeenCalled()
  expect(m.events).not.toHaveBeenCalled()
})
