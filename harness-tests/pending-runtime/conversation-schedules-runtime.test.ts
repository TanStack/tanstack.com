import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { defaultPolicy } from '../../src/chat/core/types'
import { ScheduleStore } from '../../src/chat/server/schedules'
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
  const spec = {
    name: 'Synthetic scheduled task',
    objective: 'Summarize synthetic notes.',
    timezone: 'UTC',
    recurrence: { kind: 'once' as const, at: now + 1000 },
  }
  const create = async () => {
    const result = await h.c.changeSchedule(identity, {
      type: 'create',
      commandId: crypto.randomUUID(),
      spec,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error)
    return result.snapshot
  }
  return {
    ...h,
    spec,
    create,
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}
it('admits one occurrence on duplicate alarms and completes one exact scheduled run', async () => {
  const h = await setup()
  const created = await h.create()
  expect(created.schedules).toHaveLength(1)
  expect(await h.ctx.storage.getAlarm()).toBe(h.spec.recurrence.at)
  h.advance(1000)
  await h.ctx.storage.deleteAlarm()
  await h.c.alarm()
  await h.settle()
  await h.c.alarm()
  await h.settle()
  const schedules = await h.c.scheduleSnapshot(identity)
  expect(schedules.occurrences).toHaveLength(1)
  const occurrence = schedules.occurrences[0]
  expect(occurrence.status).toBe('completed')
  expect(occurrence.runMessageId).toBe(occurrence.id)
  const runs = (await h.c.runHistory(identity)).items
  expect(runs).toHaveLength(1)
  expect(runs[0]).toMatchObject({
    id: occurrence.id,
    status: 'completed',
    origin: {
      kind: 'schedule',
      scheduleId: created.schedules[0].id,
      revision: 1,
      occurrenceId: occurrence.id,
    },
  })
})
it('rolls definition and command receipt back when the alarm write fails, then safely retries', async () => {
  const h = await setup()
  const command = {
    type: 'create' as const,
    commandId: crypto.randomUUID(),
    spec: h.spec,
  }
  h.ctx.storage.setAlarm.mockRejectedValueOnce(
    new Error('Synthetic alarm failure'),
  )
  await expect(h.c.changeSchedule(identity, command)).rejects.toThrow(
    'Synthetic alarm failure',
  )
  expect((await h.c.scheduleSnapshot(identity)).schedules).toHaveLength(0)
  expect(await h.ctx.storage.getAlarm()).toBeNull()
  const retry = await h.c.changeSchedule(identity, command)
  expect(retry.ok && retry.snapshot.schedules).toHaveLength(1)
  expect(await h.ctx.storage.getAlarm()).toBe(h.spec.recurrence.at)
  const repeated = await h.c.changeSchedule(identity, command)
  expect(repeated.ok && repeated.snapshot.schedules).toHaveLength(1)
})
it('cancels an exact queued occurrence without executing it or admitting it on another alarm', async () => {
  const h = await setup()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  await h.create()
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  const queued = (await h.c.scheduleSnapshot(identity)).occurrences[0]
  expect(queued.status).toBe('queued')
  expect(queued.runMessageId).toBeUndefined()
  expect((await h.c.snapshot()).queue!.items).toHaveLength(1)
  await h.c.changeSchedule(identity, {
    type: 'cancel-run',
    commandId: crypto.randomUUID(),
    occurrenceId: queued.id,
  })
  expect((await h.c.snapshot()).queue!.items).toHaveLength(0)
  expect((await h.c.runHistory(identity)).items[0].status).toBe('cancelled')
  await h.c.alarm()
  await h.settle()
  expect((await h.c.snapshot()).messages).toHaveLength(0)
  expect((await h.c.scheduleSnapshot(identity)).occurrences).toHaveLength(1)
})
it('reset pauses future schedules while preserving definitions and occurrence receipts', async () => {
  const h = await setup()
  const created = await h.create()
  await h.c.reset()
  const paused = await h.c.scheduleSnapshot(identity)
  expect(paused.schedules[0]).toMatchObject({
    id: created.schedules[0].id,
    status: 'paused',
  })
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  expect((await h.c.runHistory(identity)).items).toHaveLength(0)
  const restored = await h.reconstruct()
  expect((await restored.scheduleSnapshot(identity)).schedules[0].status).toBe(
    'paused',
  )
})
it('updating a queued occurrence removes it while keeping its immutable old configuration', async () => {
  const h = await setup()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  const created = await h.create()
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  const occurrence = (await h.c.scheduleSnapshot(identity)).occurrences[0]
  await h.c.changeSchedule(identity, {
    type: 'update',
    commandId: crypto.randomUUID(),
    id: created.schedules[0].id,
    revision: 1,
    spec: {
      ...h.spec,
      objective: 'Different future task',
      recurrence: { kind: 'once', at: h.now() + 10000 },
    },
  })
  expect((await h.c.snapshot()).queue!.items).toHaveLength(0)
  expect((await h.c.scheduleSnapshot(identity)).occurrences[0]).toMatchObject({
    id: occurrence.id,
    revision: 1,
    status: 'cancelled',
  })
  const storage = new ScheduleStore(
    h.ctx.storage.sql as ConstructorParameters<typeof ScheduleStore>[0],
  )
  expect(storage.configuration(occurrence)).toEqual(h.spec)
})
it('pauses schedules on current policy loss before admitting background work', async () => {
  const h = await setup()
  await h.create()
  await h.db`UPDATE chat_workspaces SET policy=${h.db.json({ ...defaultPolicy, allowChatModels: false })} WHERE id='w'`
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  expect((await h.c.scheduleSnapshot(identity)).schedules[0]).toMatchObject({
    status: 'paused',
    pauseReason: 'access-unavailable',
  })
  expect((await h.c.runHistory(identity)).items).toHaveLength(0)
})
it('expires a paused queued occurrence instead of starting stale work', async () => {
  const h = await setup()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  await h.create()
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  const occurrence = (await h.c.scheduleSnapshot(identity)).occurrences[0]
  h.advance(3600000)
  await h.c.alarm()
  await h.settle()
  expect((await h.c.snapshot()).queue!.items).toHaveLength(0)
  expect((await h.c.scheduleSnapshot(identity)).occurrences[0]).toMatchObject({
    id: occurrence.id,
    status: 'skipped',
    reason: 'start-deadline',
  })
  expect((await h.c.snapshot()).messages).toHaveLength(0)
})

it('retries the exact cancel command after the running occurrence settles without recancelling it', async () => {
  const h = await setup()
  h.env.GUM_FIXTURE_DELAY_MS = '10000'
  await h.create()
  h.advance(1000)
  await h.c.alarm()
  const occurrence = (await h.c.scheduleSnapshot(identity)).occurrences[0]
  expect(occurrence.status).toBe('running')
  const command = {
    type: 'cancel-run' as const,
    commandId: crypto.randomUUID(),
    occurrenceId: occurrence.id,
  }
  expect((await h.c.changeSchedule(identity, command)).ok).toBe(true)
  await h.settle()
  const settled = await h.c.runHistory(identity)
  expect(settled.items[0].status).toBe('interrupted')
  const retried = await h.c.changeSchedule(identity, command)
  expect(retried.ok).toBe(true)
  expect(await h.c.runHistory(identity)).toEqual(settled)
  expect((await h.c.scheduleSnapshot(identity)).occurrences[0].status).toBe(
    'interrupted',
  )
})

it('keeps a started schedule target after newer user runs displace it and after reconstruction', async () => {
  const h = await setup()
  await h.create()
  h.advance(1000)
  await h.c.alarm()
  await h.settle()
  const original = (await h.c.scheduleSnapshot(identity)).occurrences[0]
  expect(original.runMessageId).toBe(original.id)
  for (let index = 0; index < 21; index++) {
    h.advance(1)
    await h.c.begin(h.input(`later-${index}`, 'Synthetic later request'))
    await h.settle()
  }
  expect(
    (await h.c.snapshot()).runs.some((run) => run.id === original.runId),
  ).toBe(false)
  const restored = await h.reconstruct()
  expect(
    (await restored.scheduleSnapshot(identity)).occurrences[0].runMessageId,
  ).toBe(original.id)
})
