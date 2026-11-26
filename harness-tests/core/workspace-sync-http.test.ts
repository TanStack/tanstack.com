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
  member: vi.fn(),
  runtime: vi.fn(),
  snapshot: vi.fn(),
  read: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: mocks.user }),
}))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: mocks.runtime,
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: mocks.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('../../src/chat/server/workspace-sync-projection', () => ({
  syncMembership: mocks.member,
}))
import { handleWorkspaceSync } from '../../src/chat/server/workspace-sync-http.server'
const url =
  'https://tanstack.com/api/chat/workspace-sync/stream?workspaceId=workspace&generation=11111111-1111-4111-8111-111111111111&offset=0'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  mocks.member.mockResolvedValue({ generation: 'same' })
  mocks.runtime.mockResolvedValue({
    WORKSPACE_SYNC: {
      getByName: () => ({ snapshot: mocks.snapshot, read: mocks.read }),
    },
  })
})
it('returns the original streaming response after access revalidation', async () => {
  const response = new Response('stream', {
    headers: { 'Stream-Next-Offset': '1' },
  })
  mocks.read.mockResolvedValue(response)
  expect(await handleWorkspaceSync(new Request(url), 'stream')).toBe(response)
  expect(mocks.user).toHaveBeenCalledTimes(2)
  expect(mocks.member).toHaveBeenCalledTimes(2)
})
it('cancels a long-poll response when membership changes', async () => {
  const cancel = vi.fn()
  mocks.read.mockResolvedValue(new Response(new ReadableStream({ cancel })))
  mocks.member
    .mockResolvedValueOnce({ generation: 'old' })
    .mockResolvedValueOnce({ generation: 'new' })
  expect((await handleWorkspaceSync(new Request(url), 'stream')).status).toBe(
    403,
  )
  expect(cancel).toHaveBeenCalledTimes(1)
})
it('rejects a snapshot if membership changes while publishing', async () => {
  mocks.snapshot.mockResolvedValue({ state: {} })
  mocks.member
    .mockResolvedValueOnce({ generation: 'old' })
    .mockResolvedValueOnce({ generation: 'new' })
  expect((await handleWorkspaceSync(new Request(url), 'snapshot')).status).toBe(
    403,
  )
})
it('denies signed-out requests before sync storage', async () => {
  mocks.user.mockResolvedValue(null)
  expect((await handleWorkspaceSync(new Request(url), 'stream')).status).toBe(
    401,
  )
  expect(mocks.runtime).not.toHaveBeenCalled()
})
