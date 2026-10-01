// HTTP fixtures represent admitted accounts. Real grants are covered in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, describe, expect, it, vi } from 'vitest'
const dep = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  env: vi.fn(),
  api: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: dep.user }),
}))
vi.mock('~/chat/workspace-policy.server', async (original) => ({
  ...(await original()),
  readWorkspacePolicy: dep.policy,
}))
vi.mock('~/chat/server/kody-environment.server', async (original) => ({
  ...(await original()),
  getKodyEnvironment: dep.env,
}))
vi.mock('~/chat/server/skill-api', () => ({ skillApi: dep.api }))
import { handleSkills } from '../../src/routes/api/chat/skills'
import { WorkspacePolicyError } from '../../src/chat/workspace-policy.server'
beforeEach(() => {
  vi.clearAllMocks()
  dep.user.mockResolvedValue({ userId: 'trusted', capabilities: ['builder'] })
  dep.policy.mockResolvedValue({})
  dep.env.mockResolvedValue({ KODY_ORIGIN: '', ENCRYPTION_KEY: '' })
  dep.api.mockResolvedValue(Response.json({ items: [] }))
})
const request = () =>
  new Request(
    'https://tanstack.com/api/chat/skills?workspaceId=personal&userId=other',
  )
describe('authenticated skill route', () => {
  it('requires sign-in', async () => {
    dep.user.mockResolvedValue(null)
    expect((await handleSkills(request())).status).toBe(401)
    expect(dep.api).not.toHaveBeenCalled()
  })
  it('uses only the authenticated account', async () => {
    expect((await handleSkills(request())).status).toBe(200)
    expect(dep.policy).toHaveBeenCalledWith('personal', 'trusted')
    expect(dep.api.mock.calls[0][2]).toEqual({
      workspaceId: 'personal',
      userId: 'trusted',
    })
  })
  it('denies inaccessible workspaces before reading integration settings', async () => {
    dep.policy.mockRejectedValue(new WorkspacePolicyError())
    expect((await handleSkills(request())).status).toBe(403)
    expect(dep.env).not.toHaveBeenCalled()
  })
  it('rejects cross-origin mutations before reading credentials', async () => {
    expect(
      (
        await handleSkills(
          new Request(request(), {
            method: 'POST',
            headers: { Origin: 'https://other.example' },
          }),
        )
      ).status,
    ).toBe(403)
    expect(dep.user).not.toHaveBeenCalled()
  })
})
