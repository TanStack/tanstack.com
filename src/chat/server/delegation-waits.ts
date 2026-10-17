import type { SqlStorage } from '@cloudflare/workers-types'
import { canonicalCopyJson } from '../core/conversation-copy'
import {
  delegationParentSchema,
  type DelegationParent,
} from '../core/delegation'
import {
  delegationWaitRequestSchema,
  delegationWaitSchema,
  type DelegationWait,
  type DelegationWaitRequest,
} from '../core/delegation-wait'

/** A claim and the resumed conversation state must commit in the same host
 * transaction, before starting inference. A claim is never replayed on recovery. */
export class DelegationWaits {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS delegation_waits(id TEXT PRIMARY KEY,parent_key TEXT NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL)',
    )
    sql.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS delegation_waits_active ON delegation_waits(parent_key) WHERE status='waiting'",
    )
  }
  get(id: string): DelegationWait | undefined {
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM delegation_waits WHERE id=?',
        id,
      )
      .toArray()[0]
    return row ? delegationWaitSchema.parse(JSON.parse(row.json)) : undefined
  }
  create(raw: DelegationWaitRequest): DelegationWait {
    const input = delegationWaitRequestSchema.parse(raw)
    const old = this.get(input.id)
    if (old) {
      const {
        status: _status,
        updatedAt: _updatedAt,
        executionId: _executionId,
        ...request
      } = old
      if (canonicalCopyJson(input) !== canonicalCopyJson(request))
        throw new Error('This wait ID belongs to a different request.')
      return old
    }
    const key = canonicalCopyJson(input.parent)
    if (
      this.sql
        .exec(
          "SELECT id FROM delegation_waits WHERE parent_key=? AND status='waiting'",
          key,
        )
        .toArray().length
    )
      throw new Error('This task is already waiting for delegated work.')
    const record = delegationWaitSchema.parse({
      ...input,
      status: 'waiting',
      updatedAt: input.createdAt,
    })
    this.sql.exec(
      'INSERT INTO delegation_waits VALUES(?,?,?,?)',
      record.id,
      key,
      record.status,
      JSON.stringify(record),
    )
    return record
  }
  claim(
    id: string,
    parent: DelegationParent,
    executionId: string,
    now: number,
  ): DelegationWait {
    const old = this.require(id, parent)
    if (old.status === 'resumed') {
      if (old.executionId !== executionId)
        throw new Error('This wait already resumed another execution.')
      return old
    }
    if (old.status !== 'waiting') throw new Error('This wait was cancelled.')
    return this.update({
      ...old,
      status: 'resumed',
      executionId,
      updatedAt: now,
    })
  }
  cancel(id: string, parent: DelegationParent, now: number): DelegationWait {
    const old = this.require(id, parent)
    if (old.status !== 'waiting') return old
    return this.update({ ...old, status: 'cancelled', updatedAt: now })
  }
  cancelled(parent: DelegationParent): DelegationWait[] {
    return this.sql
      .exec<{ json: string }>(
        "SELECT json FROM delegation_waits WHERE parent_key=? AND status='cancelled'",
        canonicalCopyJson(parent),
      )
      .toArray()
      .map((row) => delegationWaitSchema.parse(JSON.parse(row.json)))
  }
  private require(id: string, parent: DelegationParent) {
    const record = this.get(id)
    if (
      !record ||
      canonicalCopyJson(record.parent) !==
        canonicalCopyJson(delegationParentSchema.parse(parent))
    )
      throw new Error('The wait does not belong to this task.')
    return record
  }
  private update(input: DelegationWait) {
    const record = delegationWaitSchema.parse(input)
    const old = this.get(record.id)!
    if (record.updatedAt < old.updatedAt)
      throw new Error('Wait updates cannot move backward in time.')
    this.sql.exec(
      'UPDATE delegation_waits SET status=?,json=? WHERE id=?',
      record.status,
      JSON.stringify(record),
      record.id,
    )
    return record
  }
}
