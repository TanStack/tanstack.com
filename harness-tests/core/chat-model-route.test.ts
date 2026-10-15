// HTTP fixtures represent admitted accounts. Real grants are covered in chat-access.test.ts.
vi.mock('~/chat/access.server', () => ({
  hasChatAccess: async (user: { capabilities: string[] }) =>
    user.capabilities.includes('builder') ||
    user.capabilities.includes('admin'),
}))
import { beforeEach, describe, expect, it, vi } from 'vitest'
const dependencies = vi.hoisted(() => ({
  user: vi.fn(),
  policy: vi.fn(),
  environment: vi.fn(),
  catalog: vi.fn(),
}))
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => ({ getCurrentUser: dependencies.user }),
}))
vi.mock('~/chat/workspace-policy.server', async (importOriginal) => ({
  ...(await importOriginal()),
  readWorkspacePolicy: dependencies.policy,
}))
vi.mock('~/chat/server/model-environment.server', () => ({
  getModelEnvironment: dependencies.environment,
}))
vi.mock('~/chat/server/run-models', async (importOriginal) => ({
  ...(await importOriginal()),
  getRunModelCatalog: dependencies.catalog,
}))
import { handleModelCatalog } from '../../src/routes/api/chat/models'
import { WorkspacePolicyError } from '../../src/chat/workspace-policy.server'
import { RunModelError } from '../../src/chat/server/run-models'
import { defaultPolicy } from '../../src/chat/core/types'
const request = (query = 'workspaceId=personal') =>
  new Request(`https://tanstack.com/api/chat/models?${query}`)
beforeEach(() => {
  vi.clearAllMocks()
  dependencies.user.mockResolvedValue({
    userId: 'trusted-account',
    capabilities: ['builder'],
  })
  dependencies.policy.mockResolvedValue(defaultPolicy)
  dependencies.environment.mockResolvedValue({
    ENCRYPTION_KEY: 'test-secret',
    INCLUDED_MODEL: 'model',
  })
  dependencies.catalog.mockResolvedValue({
    defaultSelection: { provider: 'included', model: 'model' },
    choices: [],
  })
})
describe('authenticated model catalog', () => {
  it('requires an authenticated account', async () => {
    dependencies.user.mockResolvedValue(null)
    expect((await handleModelCatalog(request())).status).toBe(401)
    expect(dependencies.policy).not.toHaveBeenCalled()
  })
  it('enforces the site capability before looking up models', async () => {
    dependencies.user.mockResolvedValue({
      userId: 'trusted-account',
      capabilities: [],
    })
    expect((await handleModelCatalog(request())).status).toBe(403)
    expect(dependencies.catalog).not.toHaveBeenCalled()
  })
  it('requires a workspace', async () => {
    expect((await handleModelCatalog(request(''))).status).toBe(400)
    expect(dependencies.policy).not.toHaveBeenCalled()
  })
  it('uses session ownership and server policy with real-model mode', async () => {
    const response = await handleModelCatalog(
      request('workspaceId=personal&userId=someone-else&fixture=true'),
    )
    expect(response.status).toBe(200)
    expect(dependencies.policy).toHaveBeenCalledWith(
      'personal',
      'trusted-account',
    )
    expect(dependencies.catalog.mock.calls[0][1]).toEqual({
      userId: 'trusted-account',
      policy: defaultPolicy,
      fixture: false,
    })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('test-secret')
  })
  it('denies inaccessible workspaces before resolving credentials', async () => {
    dependencies.policy.mockRejectedValue(new WorkspacePolicyError())
    expect((await handleModelCatalog(request())).status).toBe(403)
    expect(dependencies.environment).not.toHaveBeenCalled()
  })
  it('reports missing configuration instead of substituting a fixture', async () => {
    dependencies.environment.mockRejectedValue(
      new RunModelError('Not configured.', 503),
    )
    expect((await handleModelCatalog(request())).status).toBe(503)
    expect(dependencies.catalog).not.toHaveBeenCalled()
  })
})
