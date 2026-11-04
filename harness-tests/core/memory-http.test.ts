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
  scope: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  command: vi.fn(),
  preferences: vi.fn(),
  setPreferences: vi.fn(),
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
vi.mock('../../src/chat/server/memory', () => ({
  Memories: class {
    constructor(scope: unknown) {
      m.scope(scope)
    }
    list = m.list
    read = m.read
    command = m.command
    preferences = m.preferences
    setPreferences = m.setPreferences
  },
  MemoryError: class extends Error {
    status = 400
  },
}))
import { handleMemory } from '../../src/chat/server/memory-http.server'
const url =
  'https://tanstack.com/api/chat/conversations/parent/memories?workspaceId=workspace'
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
  m.read.mockResolvedValue({ id: 'memory' })
  m.preferences.mockResolvedValue({ enabled: true })
})
it('retains original list filters and private responses with authorized scope', async () => {
  const response = await handleMemory(
    new Request(url + '&query=lunch&afterId=previous&limit=10'),
    'parent',
  )
  expect(await response.json()).toEqual({ items: [] })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(m.list).toHaveBeenCalledWith({
    query: 'lunch',
    afterId: 'previous',
    limit: 10,
  })
  expect(m.scope).toHaveBeenCalledWith({
    conversationId: 'authorized',
    workspaceId: 'workspace',
    userId: 'owner',
    botId: 'bot',
  })
})
it('reads memory through the original service', async () => {
  await handleMemory(new Request(url), 'parent', 'memory')
  expect(m.read).toHaveBeenCalledWith('memory')
})
it('reads preferences without confusing them with a memory ID', async () => {
  await handleMemory(new Request(url), 'parent', 'preferences')
  expect(m.preferences).toHaveBeenCalled()
  expect(m.read).not.toHaveBeenCalled()
})
it('preserves command payload after ownership checks', async () => {
  const command = { type: 'archive', id: 'memory', commandId: 'receipt' }
  m.command.mockResolvedValue({ archived: true })
  expect(
    (
      await handleMemory(
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
it('denies cross-origin mutation before authentication', async () => {
  expect(
    (
      await handleMemory(
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
it('rejects invalid pagination without service reads', async () => {
  expect(
    (await handleMemory(new Request(url + '&limit=invalid'), 'parent')).status,
  ).toBe(400)
  expect(m.list).not.toHaveBeenCalled()
})
