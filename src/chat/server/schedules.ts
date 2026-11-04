import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import { callKey } from '../core/assistant-task'
import {
  conversationRunIdentitySchema,
  type ConversationRun,
} from '../core/conversation-runs'
import {
  scheduleCommandSchema,
  scheduleRecordSchema,
  scheduleOccurrenceSchema,
  scheduleEpochSchema,
  scheduleSpecSchema,
  type ScheduleCommand,
  type ScheduleRecord,
  type ScheduleOccurrence,
  type ScheduleSpec,
} from '../core/schedules'
import { nextScheduleTime, latestScheduleTime } from './schedule-time'

type Identity = ConversationRun['identity']
export type ScheduleCommandResult = {
  schedule?: ScheduleRecord
  occurrence?: ScheduleOccurrence
  cancelRunIds: string[]
}
export class ScheduleStoreError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 409,
  ) {
    super(message)
  }
}
const grace = 60 * 60 * 1000
const outstanding = [
  'pending',
  'queued',
  'running',
  'waiting_approval',
  'waiting_user',
  'waiting_children',
]
const cancellable = ['pending', 'queued']
const instant = scheduleEpochSchema
const safeReason = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/)
const scheduledOrigin = z.object({
  kind: z.literal('schedule'),
  scheduleId: z.string().uuid(),
  revision: z.number().int().min(1),
  occurrenceId: z.string().uuid(),
})
/** Synchronous local state only. Caller must wrap mutations plus alarm updates in
 * its DO storage transaction and authorize the exact current conversation. */
export class ScheduleStore {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS schedule_scope (id INTEGER PRIMARY KEY CHECK(id=1),identity TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY,status TEXT NOT NULL,json TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS schedule_revisions (schedule_id TEXT NOT NULL,revision INTEGER NOT NULL,spec TEXT NOT NULL,PRIMARY KEY(schedule_id,revision))',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS schedule_occurrences (id TEXT PRIMARY KEY,schedule_id TEXT NOT NULL,revision INTEGER NOT NULL,source TEXT NOT NULL,due_at INTEGER NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL)',
    )
    sql.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS schedule_timer_identity ON schedule_occurrences(schedule_id,revision,due_at) WHERE source='timer'",
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS schedule_occurrence_status ON schedule_occurrences(status,created_at,id)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS schedule_commands (id TEXT PRIMARY KEY,input TEXT NOT NULL,result TEXT NOT NULL)',
    )
  }
  private scope(identity: Identity) {
    const encoded = callKey(conversationRunIdentitySchema.parse(identity))
    const prior = this.sql
      .exec<{ identity: string }>(
        'SELECT identity FROM schedule_scope WHERE id=1',
      )
      .toArray()[0]
    if (prior && prior.identity !== encoded)
      throw new ScheduleStoreError('Schedule identity cannot change.')
    if (!prior) this.sql.exec('INSERT INTO schedule_scope VALUES(1,?)', encoded)
  }
  private records() {
    return this.sql
      .exec<{ json: string }>(
        "SELECT json FROM schedules WHERE status<>'deleted' ORDER BY id",
      )
      .toArray()
      .map((row) => scheduleRecordSchema.parse(JSON.parse(row.json)))
  }
  private get(id: string) {
    const row = this.sql
      .exec<{ json: string }>('SELECT json FROM schedules WHERE id=?', id)
      .toArray()[0]
    if (!row) throw new ScheduleStoreError('Schedule not found.', 404)
    return scheduleRecordSchema.parse(JSON.parse(row.json))
  }
  private save(record: ScheduleRecord) {
    record = scheduleRecordSchema.parse(record)
    this.sql.exec(
      'INSERT INTO schedules VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,json=excluded.json',
      record.id,
      record.status,
      JSON.stringify(record),
    )
  }
  private saveOccurrence(value: ScheduleOccurrence) {
    value = scheduleOccurrenceSchema.parse(value)
    this.sql.exec(
      'INSERT INTO schedule_occurrences VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,json=excluded.json',
      value.id,
      value.scheduleId,
      value.revision,
      value.source,
      value.dueAt,
      value.createdAt,
      value.status,
      JSON.stringify(value),
    )
  }
  getOccurrence(id: string) {
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM schedule_occurrences WHERE id=?',
        id,
      )
      .toArray()[0]
    return row
      ? scheduleOccurrenceSchema.parse(JSON.parse(row.json))
      : undefined
  }
  private active() {
    return this.sql
      .exec<{ json: string }>(
        `SELECT json FROM schedule_occurrences WHERE status IN ('pending','queued','running','waiting_approval','waiting_user','waiting_children') ORDER BY created_at,id`,
      )
      .toArray()
      .map((row) => scheduleOccurrenceSchema.parse(JSON.parse(row.json)))
  }
  private cancelUnstarted(scheduleId: string, now: number) {
    const ids: string[] = []
    for (const occurrence of this.active().filter(
      (item) =>
        item.scheduleId === scheduleId && cancellable.includes(item.status),
    )) {
      this.saveOccurrence({
        ...occurrence,
        status: 'cancelled',
        reason: 'schedule-changed',
        updatedAt: now,
        retryAt: undefined,
      })
      if (occurrence.runId) ids.push(occurrence.runId)
    }
    return ids
  }
  private make(
    record: ScheduleRecord,
    source: 'timer' | 'manual',
    dueAt: number,
    now: number,
    status: ScheduleOccurrence['status'] = 'pending',
    reason?: string,
  ) {
    const occurrence: ScheduleOccurrence = {
      id: crypto.randomUUID(),
      scheduleId: record.id,
      revision: record.revision,
      source,
      dueAt,
      createdAt: now,
      updatedAt: now,
      status,
      ...(reason ? { reason } : {}),
    }
    this.saveOccurrence(occurrence)
    return occurrence
  }
  command(
    identity: Identity,
    raw: ScheduleCommand,
    now: number,
  ): ScheduleCommandResult {
    const command = scheduleCommandSchema.parse(raw)
    instant.parse(now)
    this.scope(identity)
    const digest = callKey({ identity, command })
    const receipt = this.sql
      .exec<{ input: string; result: string }>(
        'SELECT input,result FROM schedule_commands WHERE id=?',
        command.commandId,
      )
      .toArray()[0]
    if (receipt) {
      if (receipt.input !== digest)
        throw new ScheduleStoreError(
          'This command ID was used for different settings.',
        )
      return JSON.parse(receipt.result)
    }
    const result: ScheduleCommandResult = { cancelRunIds: [] }
    if (command.type === 'create') {
      if (
        this.records().filter((item) => item.status !== 'deleted').length >= 10
      )
        throw new ScheduleStoreError(
          'This conversation already has ten schedules.',
        )
      const nextDueAt = nextScheduleTime(command.spec, now)
      if (nextDueAt === undefined)
        throw new ScheduleStoreError(
          'Choose a future time for this schedule.',
          400,
        )
      const record: ScheduleRecord = {
        id: crypto.randomUUID(),
        identity,
        revision: 1,
        status: 'active',
        spec: command.spec,
        createdAt: now,
        updatedAt: now,
        nextDueAt,
      }
      this.save(record)
      this.sql.exec(
        'INSERT INTO schedule_revisions VALUES(?,?,?)',
        record.id,
        1,
        JSON.stringify(record.spec),
      )
      result.schedule = record
    } else if (command.type === 'cancel-run') {
      const occurrence = this.getOccurrence(command.occurrenceId)
      if (!occurrence)
        throw new ScheduleStoreError('Scheduled run not found.', 404)
      if (cancellable.includes(occurrence.status)) {
        result.occurrence = {
          ...occurrence,
          status: 'cancelled',
          updatedAt: now,
          reason: 'cancelled-by-user',
          retryAt: undefined,
        }
        this.saveOccurrence(result.occurrence)
      } else result.occurrence = occurrence
      if (outstanding.includes(occurrence.status) && occurrence.runId)
        result.cancelRunIds.push(occurrence.runId)
    } else {
      const current = this.get(command.id)
      if (current.revision !== command.revision)
        throw new ScheduleStoreError(
          'This schedule changed. Refresh before trying again.',
        )
      if (current.status === 'deleted')
        throw new ScheduleStoreError('This schedule was deleted.')
      if (command.type === 'run-now') {
        if (current.status !== 'active')
          throw new ScheduleStoreError(
            'Resume this schedule before running it.',
          )
        if (this.active().some((item) => item.scheduleId === current.id))
          throw new ScheduleStoreError(
            'This schedule already has unfinished work.',
          )
        result.occurrence = this.make(current, 'manual', now, now)
        result.schedule = current
      } else {
        let record: ScheduleRecord = {
          ...current,
          revision: current.revision + 1,
          updatedAt: now,
        }
        if (command.type === 'update')
          record = {
            ...record,
            spec: command.spec,
            nextDueAt:
              current.status === 'active'
                ? nextScheduleTime(command.spec, now)
                : undefined,
          }
        if (command.type === 'pause')
          record = {
            ...record,
            status: 'paused',
            nextDueAt: undefined,
            pauseReason: 'paused-by-user',
          }
        if (command.type === 'delete')
          record = {
            ...record,
            status: 'deleted',
            nextDueAt: undefined,
            pauseReason: undefined,
          }
        if (command.type === 'resume') {
          const nextDueAt = nextScheduleTime(record.spec, now)
          if (nextDueAt === undefined)
            throw new ScheduleStoreError(
              'This one-time schedule has passed. Update its time before resuming.',
              400,
            )
          record = {
            ...record,
            status: 'active',
            nextDueAt,
            pauseReason: undefined,
          }
        }
        result.cancelRunIds = this.cancelUnstarted(current.id, now)
        this.save(record)
        this.sql.exec(
          'INSERT INTO schedule_revisions VALUES(?,?,?)',
          record.id,
          record.revision,
          JSON.stringify(record.spec),
        )
        result.schedule = record
      }
    }
    this.sql.exec(
      'INSERT INTO schedule_commands VALUES(?,?,?)',
      command.commandId,
      digest,
      JSON.stringify(result),
    )
    return result
  }
  snapshot() {
    return {
      schedules: this.records().filter((record) => record.status !== 'deleted'),
      occurrences: this.sql
        .exec<{ json: string }>(
          `SELECT json FROM schedule_occurrences WHERE status IN ('pending','queued','running','waiting_approval','waiting_user','waiting_children')
           UNION ALL SELECT json FROM (SELECT json FROM schedule_occurrences WHERE status NOT IN ('pending','queued','running','waiting_approval','waiting_user','waiting_children') ORDER BY created_at DESC,id DESC LIMIT 50)`,
        )
        .toArray()
        .map((row) => scheduleOccurrenceSchema.parse(JSON.parse(row.json)))
        .sort(
          (a, b) =>
            b.createdAt - a.createdAt ||
            (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
        ),
    }
  }
  configuration(occurrence: ScheduleOccurrence): ScheduleSpec {
    const actual = this.getOccurrence(occurrence.id)
    if (
      !actual ||
      actual.scheduleId !== occurrence.scheduleId ||
      actual.revision !== occurrence.revision
    )
      throw new ScheduleStoreError('Scheduled run identity does not match.')
    const row = this.sql
      .exec<{ spec: string }>(
        'SELECT spec FROM schedule_revisions WHERE schedule_id=? AND revision=?',
        actual.scheduleId,
        actual.revision,
      )
      .toArray()[0]
    if (!row)
      throw new ScheduleStoreError('Scheduled run settings are unavailable.')
    return scheduleSpecSchema.parse(JSON.parse(row.spec))
  }
  materializeDue(now: number) {
    instant.parse(now)
    for (const record of this.records()) {
      if (
        record.status !== 'active' ||
        record.nextDueAt === undefined ||
        record.nextDueAt > now
      )
        continue
      const latest = latestScheduleTime(record.spec, now)
      if (latest !== undefined && latest >= record.nextDueAt) {
        const exists = this.sql
          .exec(
            "SELECT id FROM schedule_occurrences WHERE schedule_id=? AND revision=? AND source='timer' AND due_at=?",
            record.id,
            record.revision,
            latest,
          )
          .toArray().length
        if (!exists) {
          const overlap = this.active().some(
            (item) => item.scheduleId === record.id,
          )
          const expired = now >= latest + grace
          this.make(
            record,
            'timer',
            latest,
            now,
            overlap || expired ? 'skipped' : 'pending',
            overlap ? 'overlap' : expired ? 'missed-deadline' : undefined,
          )
        }
      }
      this.save({
        ...record,
        nextDueAt: nextScheduleTime(record.spec, now),
        updatedAt: now,
      })
    }
    for (const occurrence of this.active())
      if (occurrence.status === 'pending' && now >= occurrence.dueAt + grace)
        this.skip(occurrence.id, 'start-deadline', now)
  }
  pending(now: number) {
    instant.parse(now)
    for (const occurrence of this.active())
      if (occurrence.status === 'pending' && now >= occurrence.dueAt + grace)
        this.skip(occurrence.id, 'start-deadline', now)
    return this.active()
      .filter((item) => item.status === 'pending' && (item.retryAt ?? 0) <= now)
      .slice(0, 10)
  }
  admit(id: string, runId: string, now: number) {
    instant.parse(now)
    z.string().min(1).max(128).parse(runId)
    const occurrence = this.getOccurrence(id)
    if (!occurrence)
      throw new ScheduleStoreError('Scheduled run not found.', 404)
    if (['cancelled', 'skipped'].includes(occurrence.status))
      throw new ScheduleStoreError('Scheduled run was cancelled or skipped.')
    if (occurrence.runId === runId) return
    if (occurrence.runId)
      throw new ScheduleStoreError(
        'Scheduled run already has an admission receipt.',
      )
    const schedule = this.get(occurrence.scheduleId)
    if (
      occurrence.status !== 'pending' ||
      schedule.status !== 'active' ||
      schedule.revision !== occurrence.revision ||
      now >= occurrence.dueAt + grace
    )
      throw new ScheduleStoreError('Scheduled run is no longer eligible.')
    this.saveOccurrence({
      ...occurrence,
      runId,
      status: 'queued',
      updatedAt: now,
      retryAt: undefined,
    })
  }
  settleFromRuns(
    runs: Pick<import('./conversation-runs').ConversationRuns, 'get'>,
    now: number,
  ) {
    instant.parse(now)
    for (const occurrence of this.active()) {
      if (!occurrence.runId) continue
      const run = runs.get(occurrence.runId)
      if (!run) continue
      const schedule = this.get(occurrence.scheduleId)
      if (callKey(run.identity) !== callKey(schedule.identity))
        throw new ScheduleStoreError('Scheduled run scope does not match.')
      const origin = scheduledOrigin.safeParse(run.origin)
      if (
        run.id !== occurrence.runId ||
        !origin.success ||
        origin.data.scheduleId !== occurrence.scheduleId ||
        origin.data.revision !== occurrence.revision ||
        origin.data.occurrenceId !== occurrence.id
      )
        throw new ScheduleStoreError('Scheduled run origin does not match.')
      if (run.status !== occurrence.status)
        this.saveOccurrence({
          ...occurrence,
          status: run.status,
          updatedAt: now,
          retryAt: undefined,
        })
    }
  }
  skip(id: string, reason: string, now: number) {
    instant.parse(now)
    safeReason.parse(reason)
    const occurrence = this.getOccurrence(id)
    if (!occurrence)
      throw new ScheduleStoreError('Scheduled run not found.', 404)
    if (!cancellable.includes(occurrence.status)) return
    this.saveOccurrence({
      ...occurrence,
      status: 'skipped',
      reason,
      updatedAt: now,
      retryAt: undefined,
    })
  }
  defer(id: string, retryAt: number, now: number) {
    instant.parse(now)
    instant.parse(retryAt)
    const occurrence = this.getOccurrence(id)
    if (!occurrence || occurrence.status !== 'pending') return
    if (retryAt <= now)
      throw new ScheduleStoreError('Retry time must be in the future.', 400)
    this.saveOccurrence({
      ...occurrence,
      retryAt: Math.min(retryAt, occurrence.dueAt + grace),
      updatedAt: now,
    })
  }
  pauseAll(reason: string, now: number) {
    instant.parse(now)
    safeReason.parse(reason)
    const ids: string[] = []
    for (const record of this.records())
      if (record.status !== 'deleted') {
        ids.push(...this.cancelUnstarted(record.id, now))
        if (record.status !== 'paused') {
          const next = {
            ...record,
            status: 'paused' as const,
            revision: record.revision + 1,
            nextDueAt: undefined,
            pauseReason: reason,
            updatedAt: now,
          }
          this.save(next)
          this.sql.exec(
            'INSERT INTO schedule_revisions VALUES(?,?,?)',
            next.id,
            next.revision,
            JSON.stringify(next.spec),
          )
        }
      }
    return ids
  }
  nextWake() {
    const times = this.records().flatMap((record) =>
      record.status === 'active' && record.nextDueAt !== undefined
        ? [record.nextDueAt]
        : [],
    )
    for (const occurrence of this.active())
      if (occurrence.status === 'queued') times.push(occurrence.dueAt + grace)
      else if (occurrence.status === 'pending')
        times.push(
          Math.min(
            occurrence.retryAt ?? occurrence.createdAt,
            occurrence.dueAt + grace,
          ),
        )
    return times.length ? Math.min(...times) : undefined
  }
}
