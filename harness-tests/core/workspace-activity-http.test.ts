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
vi.mock('../../src/chat/server/bootstrap-workspace-data', () => ({
  workspaceActivity: mocks.index,
}))
import { handleWorkspaceActivity } from '../../src/chat/server/workspace-activity-http.server'
const url = 'https://tanstack.com/api/chat/activity?workspaceId=workspace'
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
it('uses session identity and checks membership before reading activity', async () => {
  const result = await handleWorkspaceActivity(
    new Request(url + '&userId=other'),
  )
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
  expect((await handleWorkspaceActivity(new Request(url))).status).toBe(401)
  expect(mocks.policy).not.toHaveBeenCalled()
  expect(mocks.index).not.toHaveBeenCalled()
})
it('does not read activity data after membership rejection', async () => {
  const { WorkspacePolicyError } =
    await import('../../src/chat/workspace-policy.server')
  mocks.policy.mockRejectedValue(new WorkspacePolicyError())
  expect((await handleWorkspaceActivity(new Request(url))).status).toBe(403)
  expect(mocks.index).not.toHaveBeenCalled()
})
it('rejects ambiguous workspace selectors before reading membership', async () => {
  expect(
    (await handleWorkspaceActivity(new Request(url + '&workspaceId=other')))
      .status,
  ).toBe(400)
  expect(mocks.policy).not.toHaveBeenCalled()
})
it('denies accounts without chat access', async () => {
  mocks.user.mockResolvedValue({ userId: 'owner', capabilities: [] })
  expect((await handleWorkspaceActivity(new Request(url))).status).toBe(403)
  expect(mocks.index).not.toHaveBeenCalled()
})

it('retains original indexed activity envelope with session-owned identity', async () => {
  mocks.index.mockResolvedValue({ bot: { status: 'running' } })
  expect(
    await (
      await handleWorkspaceActivity(new Request(url + '&userId=other'), true)
    ).json(),
  ).toEqual({
    workspaceId: 'workspace',
    userId: 'owner',
    activity: { bot: { status: 'running' } },
  })
})
