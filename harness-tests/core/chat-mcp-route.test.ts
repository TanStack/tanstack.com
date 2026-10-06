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
vi.mock('~/chat/server/mcp-environment.server', async (original) => ({
  ...(await original()),
  getMcpEnvironment: dep.env,
}))
vi.mock('~/chat/server/mcp-account-api', () => ({ mcpAccountApi: dep.api }))
import { handleMcp } from '../../src/routes/api/chat/mcp/$'
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
    'https://tanstack.com/api/chat/mcp/accounts?workspaceId=personal&userId=other',
  )
describe('authenticated MCP route', () => {
  it('requires sign-in', async () => {
    dep.user.mockResolvedValue(null)
    expect((await handleMcp(request())).status).toBe(401)
    expect(dep.api).not.toHaveBeenCalled()
  })
  it('uses only the authenticated account', async () => {
    expect((await handleMcp(request())).status).toBe(200)
    expect(dep.policy).toHaveBeenCalledWith('personal', 'trusted')
    expect(dep.api.mock.calls[0][2]).toEqual({
      workspaceId: 'personal',
      userId: 'trusted',
    })
  })
  it('denies inaccessible workspaces before reading integration settings', async () => {
    dep.policy.mockRejectedValue(new WorkspacePolicyError())
    expect((await handleMcp(request())).status).toBe(403)
    expect(dep.env).not.toHaveBeenCalled()
  })
  it('rejects cross-origin mutations before reading credentials', async () => {
    expect(
      (
        await handleMcp(
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
