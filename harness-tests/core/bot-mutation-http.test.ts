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
  create: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  organize: vi.fn(),
  move: vi.fn(),
  restore: vi.fn(),
  history: vi.fn(),
  group: vi.fn(),
  response: vi.fn(),
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
vi.mock('../../src/chat/server/bot-workspace', () => ({
  BotWorkspace: class {
    create = m.create
    patch = m.patch
    delete = m.remove
    organize = m.organize
    move = m.move
    restore = m.restore
    applyHistory = m.history
    moveGroup = m.group
  },
}))
vi.mock('../../src/chat/server/workspace-index-response', () => ({
  workspaceIndexResponse: m.response,
}))
import { handleBotMutation } from '../../src/chat/server/bot-mutation-http.server'
const url = 'https://tanstack.com/api/chat/bots?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.runtime.mockResolvedValue({
    CONVERSATIONS: { getByName: vi.fn() },
    WORKSPACE_SYNC: {
      getByName: () => ({ snapshot: vi.fn(), publish: vi.fn() }),
    },
  })
  m.create.mockResolvedValue({ id: 'new' })
  m.patch.mockResolvedValue({ sections: [] })
  m.remove.mockResolvedValue({ sections: [] })
  m.response.mockResolvedValue(Response.json({ saved: true }))
})
it('returns the original direct creation result after workspace authorization', async () => {
  const request = new Request(url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({ name: 'Work' }),
  })
  const response = await handleBotMutation(request)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ id: 'new' })
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.create).toHaveBeenCalledWith({ name: 'Work' })
  expect(m.policy.mock.invocationCallOrder[0]).toBeLessThan(
    m.create.mock.invocationCallOrder[0],
  )
  expect(m.response).not.toHaveBeenCalled()
})
it('passes the original revision to conversation updates', async () => {
  await handleBotMutation(
    new Request(url, {
      method: 'PATCH',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify({ name: 'New', version: 2 }),
    }),
    'bot',
  )
  expect(m.patch).toHaveBeenCalledWith('bot', { name: 'New', version: 2 })
})
it('denies cross-origin changes before accessing the account', async () => {
  expect(
    (
      await handleBotMutation(
        new Request(url, {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        }),
        'bot',
        'delete',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.remove).not.toHaveBeenCalled()
})

it.each(['move', 'delete', 'restore'])(
  'dispatches %s with the original versioned body',
  async (operation) => {
    const body = { version: 3 }
    await handleBotMutation(
      new Request(url, {
        method: 'POST',
        headers: { Origin: 'https://tanstack.com' },
        body: JSON.stringify(body),
      }),
      'bot',
      operation,
    )
    const method =
      operation === 'delete'
        ? m.remove
        : operation === 'restore'
          ? m.restore
          : m.move
    expect(method).toHaveBeenCalledWith('bot', body)
    expect(m.response).toHaveBeenCalled()
  },
)
it('does not permit organization through POST', async () => {
  expect(
    (
      await handleBotMutation(
        new Request(url, { method: 'POST' }),
        'bot',
        'organization',
      )
    ).status,
  ).toBe(405)
  expect(m.user).not.toHaveBeenCalled()
})

it('passes workspace undo changes to the original history service', async () => {
  const body = { bots: [], sections: [] }
  m.history.mockResolvedValue({ restored: true })
  await handleBotMutation(
    new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
    undefined,
    undefined,
    'history',
  )
  expect(m.history).toHaveBeenCalledWith(body)
  expect(m.create).not.toHaveBeenCalled()
  expect(m.response.mock.calls[0].slice(0, 3)).toEqual([
    { restored: true },
    'workspace',
    'owner',
  ])
})
it('passes group moves to the native group command', async () => {
  const body = { ids: ['a', 'b'] }
  m.group.mockResolvedValue({ moved: true })
  await handleBotMutation(
    new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify(body),
    }),
    undefined,
    undefined,
    'move',
  )
  expect(m.group).toHaveBeenCalledWith(body)
  expect(m.create).not.toHaveBeenCalled()
  expect(m.response).toHaveBeenCalled()
})
