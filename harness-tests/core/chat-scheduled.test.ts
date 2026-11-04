import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ host: vi.fn(), recover: vi.fn() }))
vi.mock('~/server/runtime/host.server', () => ({ getHostRuntimeEnv: m.host }))
vi.mock('../../src/chat/server/workspace-sync', () => ({
  recoverWorkspaceSync: m.recover,
}))
import { recoverChatWorkspaceSync } from '../../src/chat/server/scheduled.server'
beforeEach(() => vi.resetAllMocks())
it('uses the native namespace from the shared host', async () => {
  const namespace = { getByName: vi.fn() }
  m.host.mockResolvedValue({ WORKSPACE_SYNC: namespace })
  await recoverChatWorkspaceSync()
  expect(m.recover).toHaveBeenCalledWith({ WORKSPACE_SYNC: namespace })
})
it('reports a missing binding instead of silently skipping recovery', async () => {
  m.host.mockResolvedValue({})
  await expect(recoverChatWorkspaceSync()).rejects.toThrow(
    'Workspace sync is unavailable.',
  )
  expect(m.recover).not.toHaveBeenCalled()
})
