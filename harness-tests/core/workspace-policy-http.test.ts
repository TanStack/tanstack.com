// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), update: vi.fn() }))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.read,
  updateWorkspacePolicy: m.update,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
import { handleWorkspacePolicy } from '../../src/chat/server/workspace-policy-http.server'
const url = 'https://tanstack.com/api/chat/policy?workspaceId=workspace'
const request = (origin = 'https://tanstack.com') =>
  new Request(url, {
    method: 'POST',
    headers: { Origin: origin },
    body: JSON.stringify({ allowKody: false }),
  })
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.update.mockResolvedValue({ ok: true })
})
it('uses the signed-in account for policy changes after membership validation', async () => {
  expect(await (await handleWorkspacePolicy(request())).json()).toEqual({
    ok: true,
  })
  expect(m.read).toHaveBeenCalledWith('workspace', 'owner')
  expect(m.update).toHaveBeenCalledWith('workspace', 'owner', {
    allowKody: false,
  })
  expect(m.read.mock.invocationCallOrder[0]).toBeLessThan(
    m.update.mock.invocationCallOrder[0],
  )
})
it('denies membership failures without writing policy', async () => {
  const { WorkspacePolicyError } =
    await import('../../src/chat/workspace-policy.server')
  m.read.mockRejectedValue(new WorkspacePolicyError())
  expect((await handleWorkspacePolicy(request())).status).toBe(403)
  expect(m.update).not.toHaveBeenCalled()
})
it('denies cross-origin policy changes before reading the account', async () => {
  expect(
    (await handleWorkspacePolicy(request('https://other.example'))).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.update).not.toHaveBeenCalled()
})
