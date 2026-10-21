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
  list: vi.fn(),
  cancel: vi.fn(),
  answer: vi.fn(),
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
    status = 404
  },
}))
import { handleWorkflowRun } from '../../src/chat/server/workflow-run-http.server'
const url =
  'https://tanstack.com/api/chat/conversations/parent/workflow-runs?workspaceId=workspace'
const runId = '11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.identity.mockResolvedValue({
    conversationId: 'authorized',
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
  })
  m.runtime.mockResolvedValue({
    CONVERSATIONS: {
      getByName: () => ({
        listWorkflowRuns: m.list,
        cancelWorkflowRun: m.cancel,
        readWorkflowAnswer: m.answer,
      }),
    },
  })
  m.list.mockResolvedValue({ items: [] })
  m.cancel.mockResolvedValue({ cancelled: true })
  m.answer.mockResolvedValue({ text: 'Review' })
})
it('uses source pagination and server-owned run identity', async () => {
  expect(
    await (
      await handleWorkflowRun(new Request(url + '&limit=5'), 'parent')
    ).json(),
  ).toEqual({ items: [] })
  expect(m.list).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'owner', conversationId: 'authorized' }),
    { limit: 5 },
  )
})
it('retains strict empty cancellation commands', async () => {
  const request = (body: string) =>
    new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body,
    })
  expect(
    (await handleWorkflowRun(request('{}'), 'parent', runId, true)).status,
  ).toBe(200)
  expect(m.cancel).toHaveBeenCalledWith(
    expect.objectContaining({ conversationId: 'authorized' }),
    runId,
  )
  m.cancel.mockClear()
  expect(
    (
      await handleWorkflowRun(
        request('{"userId":"other"}'),
        'parent',
        runId,
        true,
      )
    ).status,
  ).toBe(400)
  expect(m.cancel).not.toHaveBeenCalled()
})
it('reads workflow step answers through the original bounded reader', async () => {
  expect(
    await (
      await handleWorkflowRun(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify({ runId, stepId: 'review', offset: 0 }),
        }),
        'parent',
        'answer',
      )
    ).json(),
  ).toEqual({ text: 'Review' })
  expect(m.answer).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'owner' }),
    { runId, stepId: 'review', offset: 0 },
  )
})
it('denies cross-origin run actions before session lookup', async () => {
  expect(
    (
      await handleWorkflowRun(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
        'parent',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.runtime).not.toHaveBeenCalled()
})
