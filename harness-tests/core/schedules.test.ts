import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, it } from 'vitest'
import { ScheduleStore } from '../../src/chat/server/schedules'
import type {
  ScheduleCommand,
  ScheduleSpec,
} from '../../src/chat/core/schedules'
const identity = {
  workspaceId: 'w',
  userId: 'u',
  botId: 'b',
  conversationId: 'c',
}
const hour = 3600000
const once = (at = 1000): ScheduleSpec => ({
  name: 'Synthetic task',
  objective: 'Summarize the synthetic notes.',
  timezone: 'UTC',
  recurrence: { kind: 'once', at },
})
const daily: ScheduleSpec = {
  ...once(),
  recurrence: { kind: 'daily', hour: 9, minute: 0 },
}
const dbs: DatabaseSync[] = []
afterEach(() => {
  for (const db of dbs.splice(0)) db.close()
})
function fixture() {
  const db = new DatabaseSync(':memory:')
  dbs.push(db)
  const sql = {
    exec(query: string, ...args: any[]) {
      const statement = db.prepare(query)
      const rows = statement.columns().length
        ? statement.all(...args)
        : (statement.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  const store = new ScheduleStore(sql)
  const tx = <T>(work: () => T): T => {
    db.exec('BEGIN')
    try {
      const result = work()
      db.exec('COMMIT')
      return result
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  const command = (value: ScheduleCommand, now = 0) =>
    tx(() => store.command(identity, value, now))
  const create = (spec = once(), now = 0) =>
    command({ type: 'create', commandId: crypto.randomUUID(), spec }, now)
      .schedule!
  return { db, sql, store, command, create, tx }
}
it('retains idempotent command receipts across reconstruction and rejects changed input/scope', () => {
  const h = fixture()
  const command = {
    type: 'create' as const,
    commandId: crypto.randomUUID(),
    spec: once(),
  }
  const first = h.command(command)
  const restored = new ScheduleStore(h.sql)
  expect(h.tx(() => restored.command(identity, command, 20))).toEqual(first)
  expect(() =>
    h.command({ ...command, spec: { ...once(), name: 'Changed' } }),
  ).toThrow('different settings')
  for (const key of Object.keys(identity))
    expect(() =>
      h.tx(() =>
        restored.command({ ...identity, [key]: 'wrong' }, command, 20),
      ),
    ).toThrow('identity cannot change')
  expect(restored.snapshot().schedules).toHaveLength(1)
})
it('rolls back definition, receipt and recurrence together with caller transaction', () => {
  const h = fixture()
  const command = {
    type: 'create' as const,
    commandId: crypto.randomUUID(),
    spec: once(),
  }
  expect(() =>
    h.tx(() => {
      h.store.command(identity, command, 0)
      throw new Error('alarm commit failed')
    }),
  ).toThrow()
  expect(h.store.snapshot().schedules).toHaveLength(0)
  h.command(command)
  expect(() =>
    h.tx(() => {
      h.store.materializeDue(1000)
      throw new Error('rollback')
    }),
  ).toThrow()
  expect(h.store.snapshot().occurrences).toHaveLength(0)
  expect(h.store.nextWake()).toBe(1000)
  h.tx(() => h.store.materializeDue(1000))
  expect(h.store.snapshot().occurrences).toHaveLength(1)
})
it('materializes a once occurrence exactly once across repeated wakes and reconstruction', () => {
  const h = fixture()
  h.create()
  h.tx(() => h.store.materializeDue(1000))
  const first = h.store.pending(1000)[0]
  new ScheduleStore(h.sql).materializeDue(1001)
  expect(h.store.snapshot().occurrences).toEqual([first])
  expect(h.store.configuration(first)).toEqual(once())
  h.store.admit(first.id, 'run', 1001)
  h.store.admit(first.id, 'run', 1002)
  expect(h.store.getOccurrence(first.id)).toMatchObject({
    runId: 'run',
    status: 'queued',
  })
  expect(() => h.store.admit(first.id, 'different', 1003)).toThrow()
})
it('jumps years to only the latest eligible daily occurrence without catch-up replay', () => {
  const h = fixture()
  h.create(daily, Date.parse('2020-01-01T00:00:00Z'))
  const now = Date.parse('2030-06-01T09:30:00Z')
  h.store.materializeDue(now)
  expect(h.store.snapshot().occurrences).toHaveLength(1)
  expect(h.store.pending(now)[0]).toMatchObject({
    dueAt: Date.parse('2030-06-01T09:00:00Z'),
    status: 'pending',
  })
  expect(h.store.snapshot().schedules[0].nextDueAt).toBe(
    Date.parse('2030-06-02T09:00:00Z'),
  )
})
it('records late occurrences as missed and never admits them', () => {
  const h = fixture()
  h.create()
  h.store.materializeDue(1000 + hour)
  expect(h.store.snapshot().occurrences[0]).toMatchObject({
    status: 'skipped',
    reason: 'missed-deadline',
  })
  expect(h.store.pending(1000 + hour)).toHaveLength(0)
})
it('expires deferred pending work at its deadline and uses retry/deadline for wakeups', () => {
  const h = fixture()
  h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.defer(occurrence.id, 10000, 2000)
  expect(h.store.nextWake()).toBe(10000)
  expect(h.store.pending(9999)).toHaveLength(0)
  expect(h.store.pending(10000)).toHaveLength(1)
  h.store.defer(occurrence.id, 2 * hour, 10001)
  expect(h.store.nextWake()).toBe(1000 + hour)
  expect(h.store.pending(1000 + hour)).toHaveLength(0)
  expect(h.store.getOccurrence(occurrence.id)).toMatchObject({
    status: 'skipped',
    reason: 'start-deadline',
  })
  expect(h.store.nextWake()).toBeUndefined()
})
it('keeps one outstanding occurrence and records later due time overlap', () => {
  const h = fixture()
  h.create(daily, 0)
  h.store.materializeDue(9 * hour)
  const first = h.store.pending(9 * hour)[0]
  h.store.admit(first.id, 'run', 9 * hour)
  h.store.materializeDue(33 * hour)
  expect(h.store.snapshot().occurrences).toHaveLength(2)
  expect(
    h.store
      .snapshot()
      .occurrences.some(
        (item) => item.status === 'skipped' && item.reason === 'overlap',
      ),
  ).toBe(true)
  expect(h.store.getOccurrence(first.id)!.status).toBe('queued')
})
it('run-now is receipt-stable and does not move cadence', () => {
  const h = fixture()
  const schedule = h.create(daily, 0)
  const command = {
    type: 'run-now' as const,
    commandId: crypto.randomUUID(),
    id: schedule.id,
    revision: 1,
  }
  const first = h.command(command, 100)
  expect(h.command(command, 200)).toEqual(first)
  expect(h.store.snapshot().schedules[0].nextDueAt).toBe(schedule.nextDueAt)
  expect(() =>
    h.command({ ...command, commandId: crypto.randomUUID() }, 300),
  ).toThrow('unfinished work')
})
it('update cancels unstarted old revisions and preserves their immutable configuration', () => {
  const h = fixture()
  const schedule = h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.admit(occurrence.id, 'old-run', 1000)
  const updated = h.command(
    {
      type: 'update',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: 1,
      spec: { ...once(9000), objective: 'New objective' },
    },
    2000,
  )
  expect(updated.cancelRunIds).toEqual(['old-run'])
  expect(h.store.getOccurrence(occurrence.id)!.status).toBe('cancelled')
  expect(h.store.configuration(occurrence)).toEqual(once())
  expect(updated.schedule!.revision).toBe(2)
  expect(() =>
    h.command(
      {
        type: 'pause',
        commandId: crypto.randomUUID(),
        id: schedule.id,
        revision: 1,
      },
      2000,
    ),
  ).toThrow('changed')
  expect(() => h.store.configuration({ ...occurrence, revision: 2 })).toThrow(
    'identity',
  )
})
it('pauseAll cancels pending/queued runs but retains tombstones and receipts', () => {
  const h = fixture()
  const schedule = h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.admit(occurrence.id, 'run', 1000)
  expect(h.store.pauseAll('conversation-reset', 2000)).toEqual(['run'])
  expect(h.store.nextWake()).toBeUndefined()
  const paused = h.store.snapshot().schedules[0]
  expect(paused).toMatchObject({
    status: 'paused',
    pauseReason: 'conversation-reset',
    revision: 2,
  })
  expect(() =>
    h.command(
      {
        type: 'resume',
        commandId: crypto.randomUUID(),
        id: schedule.id,
        revision: 2,
      },
      3000,
    ),
  ).toThrow('one-time')
  const removed = h.command(
    {
      type: 'delete',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: 2,
    },
    3000,
  )
  expect(removed.schedule!.status).toBe('deleted')
  expect(h.store.snapshot().schedules).toHaveLength(0)
  expect(h.store.configuration(occurrence)).toEqual(once())
})
it('resumes recurring work from now without replaying the paused interval', () => {
  const h = fixture()
  const schedule = h.create(daily)
  const paused = h.command(
    {
      type: 'pause',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: 1,
    },
    100,
  )
  const now = 100 * 24 * hour + 10 * hour
  const resumed = h.command(
    {
      type: 'resume',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: paused.schedule!.revision,
    },
    now,
  )
  expect(resumed.schedule!.nextDueAt).toBe(101 * 24 * hour + 9 * hour)
  h.store.materializeDue(now)
  expect(h.store.snapshot().occurrences).toHaveLength(0)
})
it('limits live schedule identities to ten and occurrence projection to newest fifty', () => {
  const h = fixture()
  const first = h.create(daily)
  for (let i = 0; i < 9; i++) h.create(daily)
  expect(() => h.create(daily)).toThrow('ten schedules')
  for (let i = 0; i < 55; i++) {
    const occurrence = h.command(
      {
        type: 'run-now',
        commandId: crypto.randomUUID(),
        id: first.id,
        revision: 1,
      },
      i,
    ).occurrence!
    h.store.skip(occurrence.id, 'synthetic-skip', i)
  }
  const snapshot = h.store.snapshot()
  expect(snapshot.occurrences).toHaveLength(50)
  expect(snapshot.occurrences[0].createdAt).toBe(54)
  expect(snapshot.occurrences.at(-1)!.createdAt).toBe(5)
  h.command(
    {
      type: 'delete',
      commandId: crypto.randomUUID(),
      id: first.id,
      revision: 1,
    },
    60,
  )
  expect(h.create(daily).status).toBe('active')
})

it('settles only exact correlated runs and keeps running old-version settings through an update', () => {
  const h = fixture()
  const schedule = h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.admit(occurrence.id, 'run', 1000)
  const run: any = {
    id: 'run',
    identity,
    origin: {
      kind: 'schedule',
      scheduleId: schedule.id,
      revision: 1,
      occurrenceId: occurrence.id,
    },
    status: 'running',
  }
  h.store.settleFromRuns({ get: () => run }, 1001)
  const changed = h.command(
    {
      type: 'update',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: 1,
      spec: once(9000),
    },
    2000,
  )
  expect(changed.cancelRunIds).toEqual([])
  expect(h.store.configuration(occurrence)).toEqual(once())
  expect(h.store.getOccurrence(occurrence.id)!.status).toBe('running')
  h.store.settleFromRuns(
    { get: () => ({ ...run, status: 'waiting_approval' }) },
    2001,
  )
  const cancel = h.command(
    {
      type: 'cancel-run',
      commandId: crypto.randomUUID(),
      occurrenceId: occurrence.id,
    },
    2002,
  )
  expect(cancel.cancelRunIds).toEqual(['run'])
  expect(cancel.occurrence!.status).toBe('waiting_approval')
  h.store.settleFromRuns(
    { get: () => ({ ...run, status: 'interrupted' }) },
    2003,
  )
  expect(h.store.getOccurrence(occurrence.id)!.status).toBe('interrupted')
  h.store.settleFromRuns({ get: () => ({ ...run, status: 'running' }) }, 2004)
  expect(h.store.getOccurrence(occurrence.id)!.status).toBe('interrupted')
})
it('rejects unrelated or cross-scope run receipts instead of borrowing their outcomes', () => {
  const h = fixture()
  const schedule = h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.admit(occurrence.id, 'run', 1000)
  const run: any = {
    id: 'run',
    identity,
    origin: {
      kind: 'schedule',
      scheduleId: schedule.id,
      revision: 1,
      occurrenceId: occurrence.id,
    },
    status: 'completed',
  }
  for (const invalid of [
    { ...run, id: 'other' },
    { ...run, identity: { ...identity, userId: 'other' } },
    { ...run, origin: { kind: 'user', messageId: 'run' } },
    { ...run, origin: { ...run.origin, revision: 2 } },
    { ...run, origin: { ...run.origin, occurrenceId: crypto.randomUUID() } },
  ])
    expect(() => h.store.settleFromRuns({ get: () => invalid }, 2000)).toThrow(
      'does not match',
    )
  h.store.settleFromRuns({ get: () => undefined }, 2000)
  expect(h.store.getOccurrence(occurrence.id)!.status).toBe('queued')
})
it('does not revive cancelled admission and accepts only safe host reason codes', () => {
  const h = fixture()
  const schedule = h.create()
  h.store.materializeDue(1000)
  const occurrence = h.store.pending(1000)[0]
  h.store.admit(occurrence.id, 'run', 1000)
  h.command(
    {
      type: 'pause',
      commandId: crypto.randomUUID(),
      id: schedule.id,
      revision: 1,
    },
    2000,
  )
  expect(() => h.store.admit(occurrence.id, 'run', 2001)).toThrow('cancelled')
  expect(() =>
    h.store.pauseAll('Raw provider body with credentials', 2001),
  ).toThrow()
})
it('keeps old outstanding work visible beside the newest fifty terminal occurrences', () => {
  const h = fixture()
  const schedule = h.create(daily)
  const dueAt = schedule.nextDueAt!
  h.store.materializeDue(dueAt)
  const original = h.store.pending(dueAt)[0]
  h.store.admit(original.id, 'waiting-run', dueAt)
  h.store.settleFromRuns(
    {
      get: () => ({
        id: 'waiting-run',
        identity,
        origin: {
          kind: 'schedule',
          scheduleId: schedule.id,
          revision: 1,
          occurrenceId: original.id,
        },
        status: 'waiting_approval',
        mode: 'assistant',
        createdAt: dueAt,
        updatedAt: dueAt,
      }),
    },
    dueAt,
  )
  for (let day = 1; day <= 55; day++)
    h.store.materializeDue(dueAt + day * 24 * hour)
  const restored = new ScheduleStore(h.sql)
  const { occurrences } = restored.snapshot()
  expect(occurrences).toHaveLength(51)
  expect(occurrences.filter((item) => item.status === 'skipped')).toHaveLength(
    50,
  )
  expect(occurrences.at(-1)).toMatchObject({
    id: original.id,
    status: 'waiting_approval',
    runId: 'waiting-run',
  })
  expect(new Set(occurrences.map((item) => item.id)).size).toBe(51)
  expect(occurrences.map((item) => item.createdAt)).toEqual(
    occurrences.map((item) => item.createdAt).sort((a, b) => b - a),
  )
  const cancellation = h.command(
    {
      type: 'cancel-run',
      commandId: crypto.randomUUID(),
      occurrenceId: original.id,
    },
    dueAt + 56 * 24 * hour,
  )
  expect(cancellation.cancelRunIds).toEqual(['waiting-run'])
})
