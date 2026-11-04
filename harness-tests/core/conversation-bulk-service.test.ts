import { expect, it, vi } from 'vitest'
import { applyConversationBulkAction } from '../../src/chat/server/conversation-bulk-actions'
it('preserves per-chat results and original versions when one archive fails', async () => {
  const patch = vi
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('Changed'))
  const result = await applyConversationBulkAction(
    { patch, organize: vi.fn() },
    {
      bots: [
        { id: 'a', version: 1 },
        { id: 'b', version: 2 },
      ],
      action: { type: 'archive', archived: true },
    },
  )
  expect(result).toEqual({
    succeeded: ['a'],
    failed: [{ id: 'b', error: 'Changed' }],
  })
  expect(patch.mock.calls).toEqual([
    ['a', { version: 1, archived: true }],
    ['b', { version: 2, archived: true }],
  ])
})
it('passes pin actions to original organization commands', async () => {
  const organize = vi.fn().mockResolvedValue({})
  expect(
    await applyConversationBulkAction(
      { patch: vi.fn(), organize },
      {
        bots: [{ id: 'a', version: 1 }],
        action: { type: 'pin', pinned: true },
      },
    ),
  ).toEqual({ succeeded: ['a'], failed: [] })
  expect(organize).toHaveBeenCalledWith('a', { pinned: true })
})
