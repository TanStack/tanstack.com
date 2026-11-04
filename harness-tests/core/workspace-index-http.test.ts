// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  index: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: mocks.user }),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: mocks.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/workspace-index', () => ({
  readWorkspaceIndex: mocks.index,
}))
import { handleWorkspaceIndex } from '../../src/chat/server/workspace-index-http.server'
const url =
  'https://tanstack.com/api/chat/workspace-index?workspaceId=workspace'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  mocks.index.mockResolvedValue({
    workspaceId: 'workspace',
    userId: 'owner',
    bots: [],
    sections: [],
  })
})
it('uses session identity and checks membership before reading the sidebar', async () => {
  const result = await handleWorkspaceIndex(new Request(url + '&userId=other'))
  expect(result.status).toBe(200)
  expect(mocks.policy).toHaveBeenCalledWith('workspace', 'owner')
  expect(mocks.index).toHaveBeenCalledWith('workspace', 'owner')
  expect(mocks.policy.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.index.mock.invocationCallOrder[0],
  )
  expect(await result.json()).toEqual({
    workspaceId: 'workspace',
    userId: 'owner',
    bots: [],
    sections: [],
  })
})
it('denies signed-out reads without accessing workspace data', async () => {
  mocks.user.mockResolvedValue(null)
  expect((await handleWorkspaceIndex(new Request(url))).status).toBe(401)
  expect(mocks.policy).not.toHaveBeenCalled()
  expect(mocks.index).not.toHaveBeenCalled()
})
it('does not read sidebar data after membership rejection', async () => {
  const { WorkspacePolicyError } =
    await import('../../src/chat/workspace-policy.server')
  mocks.policy.mockRejectedValue(new WorkspacePolicyError())
  expect((await handleWorkspaceIndex(new Request(url))).status).toBe(403)
  expect(mocks.index).not.toHaveBeenCalled()
})
it('rejects ambiguous workspace selectors before reading membership', async () => {
  expect(
    (await handleWorkspaceIndex(new Request(url + '&workspaceId=other')))
      .status,
  ).toBe(400)
  expect(mocks.policy).not.toHaveBeenCalled()
})
it('denies accounts without chat access', async () => {
  mocks.user.mockResolvedValue({ userId: 'owner', capabilities: [] })
  expect((await handleWorkspaceIndex(new Request(url))).status).toBe(403)
  expect(mocks.index).not.toHaveBeenCalled()
})
