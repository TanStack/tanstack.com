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
  mcp: vi.fn(),
  tools: vi.fn(),
  actions: vi.fn(),
  account: vi.fn(),
  list: vi.fn(),
  inspect: vi.fn(),
  connections: vi.fn(),
  integration: vi.fn(),
  call: vi.fn(),
  describe: vi.fn(),
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
vi.mock('../../src/chat/server/mcp-environment.server', () => ({
  getMcpEnvironment: m.mcp,
  McpEnvironmentError: class extends Error {
    status = 503
  },
}))
vi.mock('../../src/chat/server/tool-reference-catalog', () => ({
  refreshToolReferences: m.tools,
  ToolReferenceError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/kody-reference-catalog', () => ({
  refreshKodyReferences: m.actions,
  listKodyReferences: m.list,
  inspectKodyReference: m.inspect,
  KodyReferenceError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/kody-account-reference-catalog', () => ({
  refreshKodyAccountReferences: m.account,
}))
vi.mock('../../src/chat/server/mcp-connections', () => ({
  connectedMcpServers: m.connections,
}))
vi.mock('../../src/chat/server/discovery-integrations', () => ({
  discoveryIntegration: m.integration,
}))
vi.mock('../../src/chat/server/mcp', () => ({ mcpCall: m.call }))
import { handleReferenceCatalog } from '../../src/chat/server/reference-catalog-http.server'
function request(origin = 'https://tanstack.com') {
  return new Request(
    'https://tanstack.com/api/chat/references/kody/refresh?workspaceId=workspace',
    { method: 'POST', headers: { Origin: origin } },
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowKody: true })
  m.runtime.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.actions.mockResolvedValue({})
  m.account.mockResolvedValue({})
  m.list.mockResolvedValue({ items: [] })
})
it('preserves action and account refresh before returning the catalog', async () => {
  expect((await handleReferenceCatalog(request(), 'kody-refresh')).status).toBe(
    200,
  )
  expect(m.actions).toHaveBeenCalledWith(
    expect.any(Object),
    { workspaceId: 'workspace', userId: 'owner' },
    { policy: { allowKody: true }, fixture: false },
    expect.any(AbortSignal),
  )
  expect(m.account).toHaveBeenCalled()
  expect(m.list).toHaveBeenCalledWith(
    expect.any(Object),
    { workspaceId: 'workspace', userId: 'owner' },
    { policy: { allowKody: true }, fixture: false, query: '' },
  )
})
it('preserves original account-refresh failure tolerance', async () => {
  m.account.mockRejectedValue(new Error('account refresh failed'))
  expect((await handleReferenceCatalog(request(), 'kody-refresh')).status).toBe(
    200,
  )
  expect(m.actions).toHaveBeenCalled()
  expect(m.list).toHaveBeenCalled()
})
it('rejects cross-origin refresh before authentication', async () => {
  expect(
    (
      await handleReferenceCatalog(
        request('https://other.example'),
        'kody-refresh',
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
  expect(m.actions).not.toHaveBeenCalled()
})

const contractUrl =
  'https://tanstack.com/api/chat/mcp/contract?workspaceId=workspace&serverId=server&entity=package:example'
it('denies untrusted discovery connections before contract reads', async () => {
  m.connections.mockResolvedValue([
    { id: 'server', trustedForDiscovery: false },
  ])
  expect(
    (await handleReferenceCatalog(new Request(contractUrl), 'mcp-contract'))
      .status,
  ).toBe(403)
  expect(m.integration).not.toHaveBeenCalled()
  expect(m.call).not.toHaveBeenCalled()
})
it('preserves unavailable paired reader response', async () => {
  m.connections.mockResolvedValue([
    { id: 'server', trustedForDiscovery: true, discoveryIntegration: 'paired' },
  ])
  m.integration.mockReturnValue({})
  expect(
    (await handleReferenceCatalog(new Request(contractUrl), 'mcp-contract'))
      .status,
  ).toBe(422)
  expect(m.call).not.toHaveBeenCalled()
})
it('reads trusted paired contracts through bounded MCP calls', async () => {
  const connection = {
    id: 'server',
    trustedForDiscovery: true,
    discoveryIntegration: 'paired',
  }
  m.connections.mockResolvedValue([connection])
  m.integration.mockReturnValue({ describe: m.describe })
  m.call.mockResolvedValue({ name: 'example' })
  m.describe.mockImplementation(
    async (
      entity: string,
      call: (name: string, args: unknown) => Promise<unknown>,
    ) => call('search', { entity }),
  )
  expect(
    await (
      await handleReferenceCatalog(new Request(contractUrl), 'mcp-contract')
    ).json(),
  ).toEqual({
    serverId: 'server',
    entity: 'package:example',
    contract: { name: 'example' },
  })
  expect(m.connections).toHaveBeenCalledWith(expect.any(Object), 'owner', {
    allowKody: true,
  })
  expect(m.call).toHaveBeenCalledWith(
    connection,
    'search',
    { entity: 'package:example' },
    expect.any(AbortSignal),
  )
})
