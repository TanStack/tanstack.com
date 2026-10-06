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
vi.mock('../../src/chat/server/workspace-sections', () => ({
  WorkspaceSections: class {
    createSection = m.create
    patchSection = m.patch
    deleteSection = m.remove
  },
}))
vi.mock('../../src/chat/server/workspace-index-response', () => ({
  workspaceIndexResponse: m.response,
}))
import { handleWorkspaceSections } from '../../src/chat/server/workspace-sections-http.server'
const url = 'https://tanstack.com/api/chat/sections?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.runtime.mockResolvedValue({
    WORKSPACE_SYNC: {
      getByName: () => ({ snapshot: vi.fn(), publish: vi.fn() }),
    },
  })
  m.create.mockResolvedValue({ id: 'new' })
  m.patch.mockResolvedValue({ sections: [] })
  m.remove.mockResolvedValue({ sections: [] })
  m.response.mockResolvedValue(Response.json({ saved: true }))
})
it('authorizes the workspace before creating and returning its committed index', async () => {
  const request = new Request(url, {
    method: 'POST',
    headers: { Origin: 'https://tanstack.com' },
    body: JSON.stringify({ name: 'Work' }),
  })
  expect((await handleWorkspaceSections(request)).status).toBe(200)
  expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.create).toHaveBeenCalledWith({ name: 'Work' })
  expect(m.policy.mock.invocationCallOrder[0]).toBeLessThan(
    m.create.mock.invocationCallOrder[0],
  )
  expect(m.response.mock.calls[0].slice(0, 3)).toEqual([
    { id: 'new' },
    'workspace',
    'owner',
  ])
})
it('passes the original revision to section updates', async () => {
  await handleWorkspaceSections(
    new Request(url, {
      method: 'PATCH',
      headers: { Origin: 'https://tanstack.com' },
      body: JSON.stringify({ name: 'New', version: 2 }),
    }),
    'section',
  )
  expect(m.patch).toHaveBeenCalledWith('section', { name: 'New', version: 2 })
})
it('denies cross-origin changes before accessing the account', async () => {
  expect(
    (
      await handleWorkspaceSections(
        new Request(url, {
          method: 'DELETE',
          headers: { Origin: 'https://other.example' },
        }),
        'section',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.remove).not.toHaveBeenCalled()
})
