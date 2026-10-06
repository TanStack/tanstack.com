import { expect, it } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'

it('keeps navigation across reconstruction, and rejects cursors after reset without returning old previews', async () => {
  const h = await conversationHarness()
  for (let i = 0; i < 9; i++) {
    await h.c.begin(h.input(`turn-${i}`))
    await h.settle()
  }
  const first = await h.c.transcriptNavigation({})
  expect(first.ok).toBe(true)
  if (!first.ok) throw new Error(first.error)
  expect(first.page.items.map((item) => item.id)).toEqual([
    'turn-0',
    'turn-1',
    'turn-2',
  ])
  const restored = await h.reconstruct()
  expect(await restored.transcriptNavigation({})).toEqual(first)
  await restored.reset()
  await h.settle()
  expect(h.local.prepare('SELECT * FROM transcript_navigation').all()).toEqual(
    [],
  )
  expect(
    await restored.transcriptNavigation({ epoch: first.page.epoch, before: 3 }),
  ).toMatchObject({ ok: false, status: 409 })
  const empty = await restored.transcriptNavigation({})
  expect(empty).toMatchObject({
    ok: true,
    page: { items: [], total: 0, nextBefore: null },
  })
  if (empty.ok) expect(empty.page.epoch).not.toBe(first.page.epoch)
})
