import { expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { ConversationStream } from '../../src/chat/server/conversation-stream'

it('acknowledges and completes a durable send while publication is blocked', async () => {
  const h = await conversationHarness()
  let release = () => {}
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const flush = vi
    .spyOn(ConversationStream.prototype, 'flush')
    .mockImplementation(() => blocked)
  try {
    const accepted = h.c.begin(h.input('blocked-publication'))
    await expect(accepted).resolves.toMatchObject({
      runId: 'blocked-publication',
    })
    expect(await h.c.sendReceipt('blocked-publication')).toEqual({
      accepted: true,
    })
    await expect
      .poll(async () => {
        const history = await h.c.runHistory({
          workspaceId: 'w',
          userId: '00000000-0000-4000-8000-000000000001',
          botId: 'b',
          conversationId: 'main-conversation',
        })
        return history.items[0]?.status
      })
      .toBe('completed')
    // Saves during generation share the existing publisher instead of starting
    // another external request for every token or state update.
    expect(flush).toHaveBeenCalledOnce()
  } finally {
    release()
    await h.settle()
    flush.mockRestore()
  }
  const restored = await h.reconstruct()
  expect(await restored.sendReceipt('blocked-publication')).toEqual({
    accepted: true,
  })
  expect(await restored.begin(h.input('blocked-publication'))).toEqual({
    duplicate: true,
  })
})

it('keeps an accepted send and schedules publication recovery after a failure', async () => {
  const h = await conversationHarness()
  const flush = vi
    .spyOn(ConversationStream.prototype, 'flush')
    .mockRejectedValue(new Error('Stream unavailable'))
  try {
    await expect(
      h.c.begin(h.input('failed-publication')),
    ).resolves.toMatchObject({
      runId: 'failed-publication',
    })
    await h.settle()
    expect(await h.c.sendReceipt('failed-publication')).toEqual({
      accepted: true,
    })
    expect(await h.ctx.storage.getAlarm()).toBeTypeOf('number')
  } finally {
    flush.mockRestore()
  }
  const restored = await h.reconstruct()
  expect(await restored.begin(h.input('failed-publication'))).toEqual({
    duplicate: true,
  })
})
