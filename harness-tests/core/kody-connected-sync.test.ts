import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  schedule: vi.fn(),
  workspace: vi.fn(),
  policy: vi.fn(),
  env: vi.fn(),
  sync: vi.fn(),
}))
vi.mock('~/server/runtime/host.server', () => ({
  scheduleHostRuntimeTask: m.schedule,
}))
vi.mock('~/chat/workspace.server', () => ({
  openPersonalChatWorkspace: m.workspace,
}))
vi.mock('~/chat/workspace-policy.server', () => ({
  readWorkspacePolicy: m.policy,
}))
vi.mock('~/chat/server/kody-environment.server', () => ({
  getKodyEnvironment: m.env,
}))
vi.mock('~/chat/server/kody-sync', () => ({ syncKodyAccount: m.sync }))
import { syncConnectedKodyAccount } from '../../src/chat/server/kody-connected-sync.server'
beforeEach(() => {
  vi.resetAllMocks()
  m.workspace.mockResolvedValue({ workspace: { id: 'personal:owner' } })
  m.policy.mockResolvedValue({ allowKody: true })
  m.env.mockResolvedValue({
    ENCRYPTION_KEY: 'key',
    KODY_ORIGIN: 'https://kody.codes',
  })
})
it('refreshes the connected account with its current workspace policy', async () => {
  m.schedule.mockReturnValue(false)
  await syncConnectedKodyAccount('owner')
  expect(m.workspace).toHaveBeenCalledWith('owner')
  expect(m.policy).toHaveBeenCalledWith('personal:owner', 'owner')
  expect(m.sync).toHaveBeenCalledWith(
    { ENCRYPTION_KEY: 'key', KODY_ORIGIN: 'https://kody.codes' },
    { workspaceId: 'personal:owner', userId: 'owner' },
    { policy: { allowKody: true }, fixture: false },
  )
})
it('uses the host background lifetime without starting a second sync', async () => {
  m.schedule.mockReturnValue(true)
  await syncConnectedKodyAccount('owner')
  expect(m.workspace).not.toHaveBeenCalled()
  await m.schedule.mock.calls[0][0]()
  expect(m.sync).toHaveBeenCalledTimes(1)
})
it('reports refresh failure without failing the established connection', async () => {
  m.schedule.mockReturnValue(false)
  m.sync.mockRejectedValue(new Error('Unavailable'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(syncConnectedKodyAccount('owner')).resolves.toBeUndefined()
  expect(log).toHaveBeenCalledWith(
    'Could not sync the connected Kody account.',
    expect.any(Error),
  )
  log.mockRestore()
})
