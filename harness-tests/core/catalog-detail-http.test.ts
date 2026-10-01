// These HTTP fixtures represent admitted accounts. Access grants are tested in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  env: vi.fn(),
  policy: vi.fn(),
  plugins: vi.fn(),
  skills: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: m.user }),
}))
vi.mock('~/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
  WorkspacePolicyError: class extends Error {
    status = 403
  },
}))
vi.mock('~/chat/server/kody-environment.server', () => ({
  getKodyEnvironment: m.env,
  KodyEnvironmentError: class extends Error {
    status = 503
  },
}))
vi.mock('~/chat/server/plugin-api', () => ({ pluginApi: m.plugins }))
vi.mock('~/chat/server/skill-api', () => ({ skillApi: m.skills }))
import { handlePlugins } from '../../src/routes/api/chat/plugins'
import { handleSkills } from '../../src/routes/api/chat/skills'
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.env.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.plugins.mockResolvedValue(new Response('{}'))
  m.skills.mockResolvedValue(new Response('{}'))
})
for (const [name, handle, service] of [
  ['plugins', handlePlugins, m.plugins],
  ['skills', handleSkills, m.skills],
] as const) {
  it(`${name} passes detail IDs and version requests to the original service with shared identity`, async () => {
    const request = new Request(
      `https://tanstack.com/api/chat/${name}/item?workspaceId=workspace&version=3&userId=forged`,
    )
    expect((await handle(request, 'item')).status).toBe(200)
    expect(m.policy).toHaveBeenCalledWith('workspace', 'owner')
    expect(service).toHaveBeenCalledWith(
      request,
      { ENCRYPTION_KEY: 'key' },
      { workspaceId: 'workspace', userId: 'owner' },
      'item',
    )
  })
  it(`${name} rejects duplicate workspace parameters`, async () => {
    expect(
      (
        await handle(
          new Request(
            `https://tanstack.com/api/chat/${name}/item?workspaceId=one&workspaceId=two`,
          ),
          'item',
        )
      ).status,
    ).toBe(400)
    expect(service).not.toHaveBeenCalled()
  })
  it(`${name} rejects cross-origin writes before reading identity`, async () => {
    expect(
      (
        await handle(
          new Request(
            `https://tanstack.com/api/chat/${name}/item?workspaceId=workspace`,
            { method: 'POST', headers: { Origin: 'https://other.example' } },
          ),
          'item',
        )
      ).status,
    ).toBe(403)
    expect(m.user).not.toHaveBeenCalled()
    expect(service).not.toHaveBeenCalled()
  })
}
it('routes plugin preview to the original preview service branch', async () => {
  const request = new Request(
    'https://tanstack.com/api/chat/plugins/preview?workspaceId=workspace',
    { method: 'POST', headers: { Origin: 'https://tanstack.com' } },
  )
  expect((await handlePlugins(request, 'preview')).status).toBe(200)
  expect(m.plugins).toHaveBeenCalledWith(
    request,
    { ENCRYPTION_KEY: 'key' },
    { workspaceId: 'workspace', userId: 'owner' },
    'preview',
  )
})
