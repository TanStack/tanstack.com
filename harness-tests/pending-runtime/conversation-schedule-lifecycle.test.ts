import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
afterEach(() => vi.restoreAllMocks())
async function setup() {
  let now = Date.parse('2030-01-01T00:00:00Z')
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const h = await conversationHarness()
  const result = await h.c.changeSchedule(identity, {
    type: 'create',
    commandId: crypto.randomUUID(),
    spec: {
      name: 'Scheduled lifecycle test',
      objective: 'Summarize synthetic notes.',
      timezone: 'UTC',
      recurrence: { kind: 'once', at: now + 1000 },
    },
  })
  if (!result.ok) throw new Error(result.error)
  return {
    ...h,
    schedule: result.snapshot.schedules[0],
    advance: () => {
      now += 1000
    },
    async suspendAndRestore(column: 'archived_at' | 'deleted_at') {
      if (column === 'archived_at') {
        await h.db`UPDATE chat_bots SET archived_at=${new Date(now)} WHERE id='b'`
        await h.db`UPDATE chat_bots SET archived_at=NULL WHERE id='b'`
      } else {
        await h.db`UPDATE chat_bots SET deleted_at=${new Date(now)} WHERE id='b'`
        await h.db`UPDATE chat_bots SET deleted_at=NULL WHERE id='b'`
      }
    },
  }
}

it.each(['archived_at', 'deleted_at'] as const)(
  'pauses a schedule after %s is set and restored before its alarm, even across reconstruction',
  async (column) => {
    const h = await setup()
    await h.suspendAndRestore(column)
    const restored = await h.reconstruct()
    h.advance()
    await h.ctx.storage.deleteAlarm()
    await restored.alarm()
    await h.settle()
    const snapshot = await restored.scheduleSnapshot(identity)
    expect(snapshot.schedules[0]).toMatchObject({
      id: h.schedule.id,
      status: 'paused',
      pauseReason: 'conversation-inactive',
      revision: h.schedule.revision + 1,
    })
    expect(snapshot.occurrences).toEqual([])
    expect((await restored.runHistory(identity)).items).toEqual([])
    expect((await restored.snapshot()).messages).toEqual([])
    expect(await restored.scheduleSnapshot(identity)).toEqual(snapshot)
  },
)

it('cancels queued schedule work when archive and restore occur before the queue resumes', async () => {
  const h = await setup()
  await h.c.updateQueue({
    type: 'pause',
    version: (await h.c.snapshot()).queue!.version,
  })
  h.advance()
  await h.ctx.storage.deleteAlarm()
  await h.c.alarm()
  await h.settle()
  const queued = (await h.c.snapshot()).queue!
  expect(queued.items).toHaveLength(1)
  const occurrenceId = queued.items[0].origin!.occurrenceId
  await h.suspendAndRestore('archived_at')
  await h.c.updateQueue({ type: 'resume', version: queued.version })
  await h.settle()
  const snapshot = await h.c.scheduleSnapshot(identity)
  expect(snapshot.schedules[0].status).toBe('paused')
  expect(snapshot.occurrences).toMatchObject([
    { id: occurrenceId, status: 'cancelled' },
  ])
  expect((await h.c.runHistory(identity)).items).toMatchObject([
    { id: occurrenceId, status: 'cancelled' },
  ])
  expect((await h.c.snapshot()).queue!.items).toEqual([])
  expect((await h.c.snapshot()).messages).toEqual([])
})

it('allows an explicit resume after reconciliation without an old generation pausing it again', async () => {
  const h = await setup()
  await h.suspendAndRestore('archived_at')
  const paused = (await h.c.scheduleSnapshot(identity)).schedules[0]
  expect(paused.status).toBe('paused')
  const resumed = await h.c.changeSchedule(identity, {
    type: 'resume',
    commandId: crypto.randomUUID(),
    id: paused.id,
    revision: paused.revision,
  })
  expect(resumed.ok).toBe(true)
  expect((await h.c.scheduleSnapshot(identity)).schedules[0].status).toBe(
    'active',
  )
  h.advance()
  await h.ctx.storage.deleteAlarm()
  await h.c.alarm()
  await h.settle()
  expect((await h.c.runHistory(identity)).items).toMatchObject([
    {
      status: 'completed',
      origin: { kind: 'schedule', scheduleId: h.schedule.id },
    },
  ])
})
