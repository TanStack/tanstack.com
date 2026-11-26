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
  job: vi.fn(),
  add: vi.fn(),
  enabled: vi.fn(),
  reconnect: vi.fn(),
  check: vi.fn(),
  invalidate: vi.fn(),
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
vi.mock('../../src/chat/server/kody-job-control', () => ({
  changeKodyJob: m.job,
  KodyJobError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/kody-server-add', () => ({
  addKodyServer: m.add,
  KodyServerAddError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/kody-server-control', () => ({
  setKodyServerEnabled: m.enabled,
  reconnectKodyServer: m.reconnect,
  checkKodyServer: m.check,
  KodyServerError: class extends Error {
    status = 409
  },
}))
vi.mock('../../src/chat/server/kody-sync', () => ({
  invalidateKodyCatalogs: m.invalidate,
}))
import { handleKodyControl } from '../../src/chat/server/kody-control-http.server'
const id = '1528b06f-2912-48f6-bda5-bc3bb7c4113b'
const input = {
  operationId: id,
  enabled: false,
  expected: { name: 'Slack', updatedAt: 'now', enabled: true },
}
function request(body: unknown, origin = 'https://tanstack.com') {
  return new Request(
    'https://tanstack.com/api/chat/kody/servers?workspaceId=workspace&userId=forged',
    {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  m.user.mockResolvedValue({ userId: 'owner', capabilities: ['builder'] })
  m.policy.mockResolvedValue({ allowKody: true })
  m.runtime.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
  m.mcp.mockResolvedValue({ ENCRYPTION_KEY: 'key' })
  m.enabled.mockResolvedValue({ id, enabled: false, changed: true })
})
it('uses signed-in scope and invalidates changed connections', async () => {
  expect(
    (await handleKodyControl(request(input), 'server-enabled', id)).status,
  ).toBe(200)
  expect(m.enabled).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key', KODY_ORIGIN: 'https://kody.codes' },
    { workspaceId: 'workspace', userId: 'owner' },
    id,
    input,
    expect.any(AbortSignal),
  )
  expect(m.invalidate).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key', KODY_ORIGIN: 'https://kody.codes' },
    'owner',
  )
})
it('does not invalidate an unchanged enable command', async () => {
  m.enabled.mockResolvedValue({ changed: false })
  await handleKodyControl(request(input), 'server-enabled', id)
  expect(m.invalidate).not.toHaveBeenCalled()
})
it('rejects blocked policy before configuration or mutation', async () => {
  m.policy.mockResolvedValue({ allowKody: false })
  expect(
    (await handleKodyControl(request(input), 'server-enabled', id)).status,
  ).toBe(403)
  expect(m.runtime).not.toHaveBeenCalled()
  expect(m.enabled).not.toHaveBeenCalled()
})
it('rejects cross-origin commands before authentication', async () => {
  expect(
    (
      await handleKodyControl(
        request(input, 'https://other.example'),
        'server-enabled',
        id,
      )
    ).status,
  ).toBe(403)
  expect(m.user).not.toHaveBeenCalled()
})
it('rejects invalid server identity without mutation', async () => {
  expect(
    (await handleKodyControl(request(input), 'server-enabled', 'invalid'))
      .status,
  ).toBe(400)
  expect(m.enabled).not.toHaveBeenCalled()
  expect(m.invalidate).not.toHaveBeenCalled()
})
