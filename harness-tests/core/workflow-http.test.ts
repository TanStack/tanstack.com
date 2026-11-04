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
  list: vi.fn(),
  read: vi.fn(),
  command: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('../../src/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: m.identity,
  ConversationIdentityError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/workflows', () => ({
  Workflows: class {
    list = m.list
    read = m.read
    command = m.command
  },
  WorkflowError: class extends Error {
    status = 400
  },
}))
import { handleWorkflow } from '../../src/chat/server/workflow-http.server'
const url =
  'https://tanstack.com/api/chat/conversations/parent/workflows?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.identity.mockResolvedValue({
    conversationId: 'authorized',
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
  })
  m.list.mockResolvedValue({ items: [] })
  m.read.mockResolvedValue({ revision: 2 })
})
it('retains original list query validation while allowing the shared workspace selector', async () => {
  expect(
    await (
      await handleWorkflow(new Request(url + '&limit=10'), 'parent')
    ).json(),
  ).toEqual({ items: [] })
  expect(m.identity).toHaveBeenCalledWith({
    conversationId: 'parent',
    workspaceId: 'workspace',
    userId: 'owner',
  })
  expect(m.list).toHaveBeenCalledWith({ after: undefined, limit: 10 })
})
it('reads a retained workflow revision through the original service', async () => {
  expect(
    await (
      await handleWorkflow(
        new Request(url + '&revision=2'),
        'parent',
        'workflow',
      )
    ).json(),
  ).toEqual({ revision: 2 })
  expect(m.read).toHaveBeenCalledWith('workflow', 2)
})
it('denies unknown and duplicate workflow query fields', async () => {
  for (const suffix of ['&limit=1&limit=2', '&fixture=true'])
    expect(
      (await handleWorkflow(new Request(url + suffix), 'parent')).status,
    ).toBe(400)
  expect(m.list).not.toHaveBeenCalled()
})
it('denies cross-origin commands before authentication', async () => {
  expect(
    (
      await handleWorkflow(
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
  expect(m.command).not.toHaveBeenCalled()
})
it('preserves the original workflow command payload after ownership checks', async () => {
  const command = {
    type: 'archive',
    id: 'workflow',
    commandId: 'receipt',
    expectedRevision: 2,
  }
  m.command.mockResolvedValue({ archived: true })
  expect(
    (
      await handleWorkflow(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://tanstack.com' },
          body: JSON.stringify(command),
        }),
        'parent',
      )
    ).status,
  ).toBe(200)
  expect(m.command).toHaveBeenCalledWith(command)
})
