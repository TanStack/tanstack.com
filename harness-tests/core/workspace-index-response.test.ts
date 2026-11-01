import { expect, it, vi } from 'vitest'
vi.mock('../../src/chat/server/workspace-index', () => ({
  readWorkspaceIndex: vi.fn(async () => ({ bots: [], sections: [] })),
}))
import { workspaceIndexResponse } from '../../src/chat/server/workspace-index-response'
it('does not report a committed write as failed when sync delivery fails', async () => {
  const response = await workspaceIndexResponse(
    { id: 'saved' },
    'workspace',
    'owner',
    { snapshot: vi.fn().mockRejectedValue(new Error('delivery unavailable')) },
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ id: 'saved', syncPending: true })
})
it('reports access loss instead of exposing a snapshot', async () => {
  const response = await workspaceIndexResponse(
    { id: 'saved' },
    'workspace',
    'owner',
    { snapshot: vi.fn().mockResolvedValue(undefined) },
  )
  expect(response.status).toBe(403)
})
it('returns the original index shape when no publisher is configured', async () => {
  expect(
    await (
      await workspaceIndexResponse({ id: 'saved' }, 'workspace', 'owner')
    ).json(),
  ).toEqual({ id: 'saved', index: { bots: [], sections: [] } })
})
