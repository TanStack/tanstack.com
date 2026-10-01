import { expect, it, vi } from 'vitest'
import { applyConversationBulkAction } from '../../src/chat/core/conversation-bulk-actions'
import type { WorkspaceBot } from '../../src/chat/core/bot-workspace'
const bot = (id: string, version = 2) =>
  ({ id, name: id, version, deleted_at: null }) as WorkspaceBot
it('keeps failed items available after a partial batch and does not retry writes', async () => {
  const request = vi.fn().mockResolvedValue({
    succeeded: ['a', 'c'],
    failed: [{ id: 'b', error: 'Version changed' }],
  })
  const result = await applyConversationBulkAction(
    [bot('a'), bot('b'), bot('c')],
    { type: 'archive', archived: true },
    request,
  )
  expect(result).toEqual({
    succeeded: ['a', 'c'],
    failed: [{ id: 'b', name: 'b', error: 'Version changed' }],
  })
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith(
    'bots/bulk',
    {
      bots: [
        { id: 'a', version: 2 },
        { id: 'b', version: 2 },
        { id: 'c', version: 2 },
      ],
      action: { type: 'archive', archived: true },
    },
    'POST',
  )
})
it('moves selected conversations out of pinned into a section using existing commands', async () => {
  const request = vi.fn().mockResolvedValue({ succeeded: ['a/b'], failed: [] })
  await applyConversationBulkAction(
    [bot('a/b')],
    { type: 'section', sectionId: 's' },
    request,
  )
  expect(request).toHaveBeenCalledWith(
    'bots/bulk',
    {
      bots: [{ id: 'a/b', version: 2 }],
      action: { type: 'section', sectionId: 's' },
    },
    'POST',
  )
})
it('does not mutate a trashed conversation', async () => {
  const request = vi.fn()
  const result = await applyConversationBulkAction(
    [{ ...bot('a'), deleted_at: 1 }],
    { type: 'pin', pinned: true },
    request,
  )
  expect(result.failed).toHaveLength(1)
  expect(request).not.toHaveBeenCalled()
})
