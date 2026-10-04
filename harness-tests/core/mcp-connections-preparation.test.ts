import { beforeEach, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'

const mocks = vi.hoisted(() => ({
  policy: vi.fn(),
  credentials: vi.fn(),
  accounts: vi.fn(),
  plugins: vi.fn(),
  runtimeAccounts: vi.fn(),
  kody: vi.fn(),
}))
vi.mock('../../src/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: mocks.policy,
}))
vi.mock('../../src/chat/server/credentials', () => ({
  readCredentials: mocks.credentials,
}))
vi.mock('../../src/chat/server/mcp-accounts', () => ({
  McpAccounts: class {
    configuredServers = mocks.accounts
  },
}))
vi.mock('../../src/chat/server/plugin-connections', () => ({
  pluginMcpConnections: mocks.plugins,
}))
vi.mock('../../src/chat/server/mcp-account-runtime', () => ({
  runtimeMcpAccounts: mocks.runtimeAccounts,
}))
vi.mock('../../src/chat/server/kody', () => ({ kodyConnection: mocks.kody }))
import { connectedMcpServers } from '../../src/chat/server/mcp-connections'

const env = {
  ENCRYPTION_KEY: 'synthetic-fixture',
  KODY_ORIGIN: 'https://example.test',
}
const scope = { workspaceId: 'fixture' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.policy.mockResolvedValue(defaultPolicy)
  mocks.credentials.mockResolvedValue(null)
  mocks.accounts.mockResolvedValue([])
  mocks.plugins.mockResolvedValue([])
  mocks.runtimeAccounts.mockResolvedValue([])
})

it('lists authorized accounts while the independent credential read is pending', async () => {
  let release = () => {}
  const gate = new Promise<null>((resolve) => {
    release = () => resolve(null)
  })
  mocks.credentials.mockReturnValue(gate)
  const result = connectedMcpServers(
    env,
    'fixture-user',
    defaultPolicy,
    undefined,
    scope,
  )
  try {
    await vi.waitFor(() => expect(mocks.accounts).toHaveBeenCalledOnce())
    release()
    await expect(result).resolves.toEqual([])
  } finally {
    release()
    await result
  }
})

it('does not read credentials or accounts when workspace authorization fails', async () => {
  mocks.policy.mockRejectedValue(new Error('Synthetic revoked membership'))
  await expect(
    connectedMcpServers(env, 'fixture-user', defaultPolicy, undefined, scope),
  ).resolves.toEqual([])
  expect(mocks.credentials).not.toHaveBeenCalled()
  expect(mocks.accounts).not.toHaveBeenCalled()
})

it('does not read Kody credentials when that capability is disabled', async () => {
  await expect(
    connectedMcpServers(
      env,
      'fixture-user',
      { ...defaultPolicy, allowKody: false },
      undefined,
      scope,
    ),
  ).resolves.toEqual([])
  expect(mocks.credentials).not.toHaveBeenCalled()
  expect(mocks.accounts).toHaveBeenCalledOnce()
})

it('settles the account read before reporting a credential failure', async () => {
  let release = () => {}
  const gate = new Promise<[]>((resolve) => {
    release = () => resolve([])
  })
  mocks.accounts.mockReturnValue(gate)
  mocks.credentials.mockRejectedValue(new Error('Synthetic credential failure'))
  let settled = false
  const result = connectedMcpServers(
    env,
    'fixture-user',
    defaultPolicy,
    undefined,
    scope,
  )
  const observed = result.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  try {
    await vi.waitFor(() => expect(mocks.accounts).toHaveBeenCalledOnce())
    expect(settled).toBe(false)
    release()
    await expect(result).rejects.toThrow('Synthetic credential failure')
  } finally {
    release()
    await observed
  }
})

it('resolves a selected Kody connection with fresh runtime authorization', async () => {
  mocks.credentials.mockResolvedValue({
    kody: { access_token: 'metadata-token' },
  })
  mocks.kody.mockResolvedValue({
    id: 'kody',
    label: 'Kody',
    url: 'https://example.test/mcp',
    accessToken: 'fresh-runtime-token',
  })
  const result = await connectedMcpServers(
    env,
    'fixture-user',
    defaultPolicy,
    'kody',
    scope,
  )
  expect(result).toHaveLength(1)
  expect(result[0].accessToken).toBe('fresh-runtime-token')
  expect(mocks.kody).toHaveBeenCalledWith(env, 'fixture-user')
  expect(mocks.accounts).not.toHaveBeenCalled()
})

it('does not read unrelated Kody credentials when resolving a selected MCP account', async () => {
  await expect(
    connectedMcpServers(
      env,
      'fixture-user',
      defaultPolicy,
      'mcp:fixture-account',
      scope,
    ),
  ).resolves.toEqual([])
  expect(mocks.credentials).not.toHaveBeenCalled()
  expect(mocks.runtimeAccounts).toHaveBeenCalledWith(
    env,
    { workspaceId: 'fixture', userId: 'fixture-user' },
    { id: 'fixture-account' },
  )
})
