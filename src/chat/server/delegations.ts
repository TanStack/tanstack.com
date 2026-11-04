import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import { callKey } from '../core/assistant-task'
import { conversationRunIdentitySchema } from '../core/conversation-runs'
import {
  delegationAdmissionSchema,
  delegationParentSchema,
  delegationRecordSchema,
  delegationTimeSchema,
  maxConcurrentDelegations,
  maxDelegationChildren,
  maxPendingDelegationBatch,
  type DelegationAdmission,
  type DelegationParent,
  type DelegationRecord,
} from '../core/delegation'

export class DelegationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 409,
  ) {
    super(message)
    this.name = 'DelegationError'
  }
}
type Row = { json: string }
const parseRow = (row: Row) =>
  delegationRecordSchema.parse(JSON.parse(row.json))
export function delegationAdmissionFromRecord(
  record: DelegationRecord,
): DelegationAdmission {
  const {
    status: _status,
    version: _version,
    updatedAt: _updatedAt,
    dispatchedAt: _dispatchedAt,
    admittedAt: _admittedAt,
    settledAt: _settledAt,
    cancelRequestedAt: _cancelRequestedAt,
    cancelledAt: _cancelledAt,
    ...input
  } = record
  return delegationAdmissionSchema.parse(input)
}

/** Parent-local admission receipts, not child execution outcomes. The caller
 * authorizes the conversation and wraps mutations plus alarm writes in its
 * synchronous storage transaction. Reset must not clear this ledger. */
export class Delegations {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY, child_conversation_id TEXT NOT NULL UNIQUE,
      identity TEXT NOT NULL, parent_task_id TEXT NOT NULL, parent_key TEXT NOT NULL,
      created_at INTEGER NOT NULL, deadline INTEGER NOT NULL,
      status TEXT NOT NULL, json TEXT NOT NULL
    )`)
    sql.exec(
      'CREATE INDEX IF NOT EXISTS delegations_task ON delegations(parent_task_id,status,created_at,id)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS delegations_deadline ON delegations(status,deadline)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS delegations_history ON delegations(identity,created_at DESC,id DESC)',
    )
  }

  get(id: string): DelegationRecord | undefined {
    const row = this.sql
      .exec<Row>('SELECT json FROM delegations WHERE id=?', z.uuid().parse(id))
      .toArray()[0]
    return row ? parseRow(row) : undefined
  }

  forParent(parent: DelegationParent): DelegationRecord[] {
    return this.sql
      .exec<Row>(
        'SELECT json FROM delegations WHERE parent_key=? ORDER BY created_at,id',
        callKey(delegationParentSchema.parse(parent)),
      )
      .toArray()
      .map(parseRow)
  }

  historicalParent(identity: DelegationParent['identity'], taskId: string) {
    const row = this.sql
      .exec<Row>(
        'SELECT json FROM delegations WHERE identity=? AND parent_task_id=? ORDER BY created_at,id LIMIT 1',
        callKey(conversationRunIdentitySchema.parse(identity)),
        z.string().min(1).max(128).parse(taskId),
      )
      .toArray()[0]
    return row ? parseRow(row).parent : undefined
  }

  /** Retained admissions across tasks and transcript resets. The caller must
   * authorize this exact conversation before presenting the public projection. */
  history(identity: DelegationParent['identity'], input: unknown = {}) {
    const scope = callKey(conversationRunIdentitySchema.parse(identity))
    const query = z
      .strictObject({
        beforeId: z.uuid().optional(),
        limit: z.number().int().min(1).max(25).default(20),
      })
      .parse(input)
    const boundary = query.beforeId ? this.get(query.beforeId) : undefined
    if (
      query.beforeId &&
      (!boundary || callKey(boundary.parent.identity) !== scope)
    )
      throw new DelegationError('The task history cursor is unavailable.', 400)
    const rows = this.sql
      .exec<Row>(
        `SELECT json FROM delegations WHERE identity=? ${boundary ? 'AND (created_at < ? OR (created_at = ? AND id < ?))' : ''} ORDER BY created_at DESC,id DESC LIMIT ?`,
        scope,
        ...(boundary
          ? [boundary.createdAt, boundary.createdAt, boundary.id]
          : []),
        query.limit + 1,
      )
      .toArray()
      .map(parseRow)
    const items = rows.slice(0, query.limit)
    return {
      items,
      ...(rows.length > query.limit ? { nextBeforeId: items.at(-1)!.id } : {}),
    }
  }

  admit(input: DelegationAdmission): DelegationRecord {
    const parsed = delegationAdmissionSchema.parse(input)
    const previous = this.get(parsed.id)
    if (previous) {
      if (callKey(delegationAdmissionFromRecord(previous)) !== callKey(parsed))
        throw new DelegationError(
          'This delegation ID belongs to a different request.',
        )
      return previous
    }
    const identity = callKey(parsed.parent.identity)
    if (
      this.sql
        .exec('SELECT id FROM delegations WHERE identity<>? LIMIT 1', identity)
        .toArray().length
    )
      throw new DelegationError(
        'Delegation identity cannot change within a conversation.',
      )
    const parentKey = callKey(parsed.parent)
    if (
      this.sql
        .exec(
          'SELECT id FROM delegations WHERE parent_task_id=? AND parent_key<>? LIMIT 1',
          parsed.parent.taskId,
          parentKey,
        )
        .toArray().length
    )
      throw new DelegationError('The parent task identity cannot change.')
    if (
      this.sql
        .exec(
          'SELECT id FROM delegations WHERE child_conversation_id=? LIMIT 1',
          parsed.childConversationId,
        )
        .toArray().length
    )
      throw new DelegationError(
        'This child conversation already belongs to a delegation.',
      )
    const count = this.sql
      .exec<{ count: number }>(
        'SELECT COUNT(*) AS count FROM delegations WHERE parent_task_id=?',
        parsed.parent.taskId,
      )
      .toArray()[0]!.count
    if (count >= maxDelegationChildren)
      throw new DelegationError('This task reached its delegation limit.')
    const record = delegationRecordSchema.parse({
      ...parsed,
      status: 'pending',
      version: 1,
      updatedAt: parsed.createdAt,
    })
    this.sql.exec(
      'INSERT INTO delegations VALUES(?,?,?,?,?,?,?,?,?)',
      record.id,
      record.childConversationId,
      identity,
      record.parent.taskId,
      parentKey,
      record.createdAt,
      record.deadline,
      record.status,
      JSON.stringify(record),
    )
    return record
  }

  /** Selection is read-only. Commit reserve() before any remote admission call. */
  pending(now: number): DelegationRecord[] {
    delegationTimeSchema.parse(now)
    return this.sql
      .exec<Row>(
        `WITH candidates AS (
      SELECT d.json,d.created_at,d.id,
        ROW_NUMBER() OVER (PARTITION BY d.parent_task_id ORDER BY d.created_at,d.id) AS position,
        (SELECT COUNT(*) FROM delegations active WHERE active.parent_task_id=d.parent_task_id AND active.status IN ('dispatching','admitted','cancelling')) AS occupied
      FROM delegations d WHERE d.status='pending' AND d.created_at<=? AND d.deadline>?
    ) SELECT json FROM candidates WHERE position<=?-occupied ORDER BY created_at,id LIMIT ?`,
        now,
        now,
        maxConcurrentDelegations,
        maxPendingDelegationBatch,
      )
      .toArray()
      .map(parseRow)
  }

  reserve(id: string, now: number): DelegationRecord {
    const old = this.require(id)
    delegationTimeSchema.parse(now)
    if (now >= old.deadline)
      throw new DelegationError('The delegation deadline has passed.')
    if (old.status === 'dispatching' || old.status === 'admitted') return old
    if (old.status !== 'pending')
      throw new DelegationError(
        'This delegation is being cancelled or has been cancelled.',
      )
    const occupied = this.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM delegations WHERE parent_task_id=? AND status IN ('dispatching','admitted','cancelling')",
        old.parent.taskId,
      )
      .toArray()[0]!.count
    if (occupied >= maxConcurrentDelegations)
      throw new DelegationError('This task has no available delegation slots.')
    return this.update(old, { status: 'dispatching', dispatchedAt: now }, now)
  }

  acknowledge(id: string, now: number): DelegationRecord {
    const old = this.require(id)
    delegationTimeSchema.parse(now)
    if (old.status === 'settled') return old
    if (now >= old.deadline)
      throw new DelegationError('The delegation deadline has passed.')
    if (old.status === 'admitted') return old
    if (old.status === 'pending')
      throw new DelegationError(
        'Reserve this delegation before admitting child work.',
      )
    if (old.status !== 'dispatching')
      throw new DelegationError(
        'This delegation is being cancelled or has been cancelled.',
      )
    return this.update(old, { status: 'admitted', admittedAt: now }, now)
  }

  /** Recovery must run expire(now) before retrying remote admission. */
  dispatching(): DelegationRecord[] {
    return this.recovery('dispatching')
  }

  cancelling(): DelegationRecord[] {
    return this.recovery('cancelling')
  }

  cancel(id: string, now: number): DelegationRecord {
    const old = this.require(id)
    delegationTimeSchema.parse(now)
    if (
      old.status === 'cancelling' ||
      old.status === 'cancelled' ||
      old.status === 'settled'
    )
      return old
    return this.update(
      old,
      { status: 'cancelling', cancelRequestedAt: now },
      now,
    )
  }

  confirmCancelled(id: string, now: number): DelegationRecord {
    const old = this.require(id)
    delegationTimeSchema.parse(now)
    if (old.status === 'cancelled') return old
    if (old.status !== 'cancelling')
      throw new DelegationError(
        'Cancellation must be requested before it can be confirmed.',
      )
    return this.update(old, { status: 'cancelled', cancelledAt: now }, now)
  }

  cancelParent(parent: DelegationParent, now: number): DelegationRecord[] {
    const parsed = delegationParentSchema.parse(parent)
    delegationTimeSchema.parse(now)
    const rows = this.sql
      .exec<Row>(
        'SELECT json FROM delegations WHERE parent_key=? ORDER BY created_at,id',
        callKey(parsed),
      )
      .toArray()
      .map(parseRow)
    // Validate the whole batch before writing any cancellation intent.
    for (const record of rows)
      if (
        record.status === 'pending' ||
        record.status === 'dispatching' ||
        record.status === 'admitted'
      )
        this.validateNow(record, now)
    return rows.map((record) => this.cancel(record.id, now))
  }

  expire(now: number): void {
    delegationTimeSchema.parse(now)
    const rows = this.sql
      .exec<Row>(
        "SELECT json FROM delegations WHERE status IN ('pending','dispatching','admitted') AND deadline<=? ORDER BY deadline,id",
        now,
      )
      .toArray()
      .map(parseRow)
    for (const record of rows) this.validateNow(record, now)
    for (const record of rows) this.cancel(record.id, now)
  }

  nextWake(): number | undefined {
    return this.sql
      .exec<{ deadline: number }>(
        "SELECT deadline FROM delegations WHERE status IN ('pending','dispatching','admitted') ORDER BY deadline,id LIMIT 1",
      )
      .toArray()[0]?.deadline
  }
  active(): DelegationRecord[] {
    return this.sql
      .exec<Row>(
        "SELECT json FROM delegations WHERE status NOT IN ('settled','cancelled') ORDER BY created_at,id LIMIT 100",
      )
      .toArray()
      .map(parseRow)
  }
  /** The coordinator must supply authoritative terminal child-run evidence. */
  settle(id: string, now: number): DelegationRecord {
    const old = this.require(id)
    delegationTimeSchema.parse(now)
    if (old.status === 'settled') return old
    if (old.dispatchedAt === undefined || old.status === 'cancelled')
      throw new DelegationError(
        'This delegation has no unsettled child admission.',
      )
    return this.update(old, { status: 'settled', settledAt: now }, now)
  }

  private require(id: string) {
    const value = this.get(id)
    if (!value) throw new DelegationError('Delegation not found.', 404)
    return value
  }
  private recovery(status: 'dispatching' | 'cancelling') {
    return this.sql
      .exec<Row>(
        'SELECT json FROM delegations WHERE status=? ORDER BY created_at,id LIMIT ?',
        status,
        maxPendingDelegationBatch,
      )
      .toArray()
      .map(parseRow)
  }
  private validateNow(record: DelegationRecord, now: number) {
    if (now < record.updatedAt)
      throw new DelegationError(
        'Delegation updates cannot move backward in time.',
      )
    if (record.version === Number.MAX_SAFE_INTEGER)
      throw new DelegationError('The delegation revision limit was reached.')
  }
  private update(
    old: DelegationRecord,
    patch: Partial<
      Pick<
        DelegationRecord,
        | 'status'
        | 'dispatchedAt'
        | 'admittedAt'
        | 'settledAt'
        | 'cancelRequestedAt'
        | 'cancelledAt'
      >
    >,
    now: number,
  ) {
    this.validateNow(old, now)
    const next = delegationRecordSchema.parse({
      ...old,
      ...patch,
      version: old.version + 1,
      updatedAt: now,
    })
    this.sql.exec(
      'UPDATE delegations SET status=?,json=? WHERE id=?',
      next.status,
      JSON.stringify(next),
      next.id,
    )
    return next
  }
}
