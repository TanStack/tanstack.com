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
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  archive: vi.fn(),
  rename: vi.fn(),
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
vi.mock('../../src/chat/server/conversation-threads', () => ({
  ConversationThreads: class {
    list = m.list
    get = m.get
    create = m.create
    archive = m.archive
    rename = m.rename
  },
  ConversationThreadError: class extends Error {
    status = 409
  },
}))
import { handleConversationThreads } from '../../src/chat/server/conversation-threads-http.server'
const url =
  'https://tanstack.com/api/chat/conversations/parent/threads?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.runtime.mockResolvedValue({ CONVERSATIONS: { getByName: vi.fn() } })
  m.list.mockResolvedValue([])
  m.get.mockResolvedValue({ version: 3 })
  m.archive.mockResolvedValue({ archived: true })
})
it('lists through the original service after workspace authorization', async () => {
  expect(
    await (
      await handleConversationThreads(new Request(url), 'parent', 'threads')
    ).json(),
  ).toEqual([])
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.list).toHaveBeenCalledWith('parent')
})
it('retains the original current-version archive behavior for DELETE', async () => {
  await handleConversationThreads(
    new Request(url, {
      method: 'DELETE',
      headers: { Origin: 'https://tanstack.com' },
    }),
    'child',
    'thread',
  )
  expect(m.archive).toHaveBeenCalledWith(
    'child',
    { type: 'archive', expectedVersion: 3, archived: true },
    true,
  )
})
it('denies cross-origin thread changes before account lookup', async () => {
  expect(
    (
      await handleConversationThreads(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
          body: '{}',
        }),
        'parent',
        'threads',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})

it('forwards the original idempotent creation request to its parent conversation', async () => {
  const body = {
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    sourceMessageId: 'message',
  }
  m.create.mockResolvedValue({ conversationId: 'child' })
  const response = await handleConversationThreads(
    new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
    'parent',
    'threads',
  )
  expect(await response.json()).toEqual({ conversationId: 'child' })
  expect(m.create).toHaveBeenCalledWith('parent', body)
})
it('passes original rename version checks without reconstructing a thread', async () => {
  const command = { type: 'rename', title: 'Focused task', expectedVersion: 3 }
  m.rename.mockResolvedValue({ title: 'Focused task', version: 4 })
  expect(
    (
      await handleConversationThreads(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify(command),
        }),
        'child',
        'thread',
      )
    ).status,
  ).toBe(200)
  expect(m.rename).toHaveBeenCalledWith('child', command)
  expect(m.create).not.toHaveBeenCalled()
})
it('rejects malformed thread commands before mutation', async () => {
  expect(
    (
      await handleConversationThreads(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify({ type: 'rename', title: 'Task' }),
        }),
        'child',
        'thread',
      )
    ).status,
  ).toBe(400)
  expect(m.rename).not.toHaveBeenCalled()
})
