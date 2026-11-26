import type { SqlStorage } from '@cloudflare/workers-types'
import { canonicalCopyJson } from '../core/conversation-copy'
import {
  delegationParentSchema,
  delegationTimeSchema,
  type DelegationParent,
} from '../core/delegation'
import {
  delegationBudgetCountersSchema,
  delegationBudgetLimits,
  delegationBudgetSnapshotSchema,
  delegationOperationSchema,
  delegationOperationReceiptSchema,
  delegationOperationCounter,
  type DelegationBudgetCounters,
  type DelegationBudgetSnapshot,
  type DelegationOperation,
  type DelegationOperationReceipt,
} from '../core/delegation-budget'

export class DelegationBudgetError extends Error {}

/** Parent-local, shared parent/child operation allowance. This is not a dollar
 * budget or a grant of authority. Reauthorize the exact task and child before
 * each reservation. Reserve before effects, never refund an uncertain attempt,
 * and compose mutations with the host's synchronous storage transaction. */
export class DelegationBudget {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS delegation_budgets (
      parent_key TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE,
      identity TEXT NOT NULL, json TEXT NOT NULL
    )`)
    sql.exec(`CREATE TABLE IF NOT EXISTS delegation_budget_operations (
      parent_key TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL,
      PRIMARY KEY(parent_key,id),
      FOREIGN KEY(parent_key) REFERENCES delegation_budgets(parent_key)
    )`)
  }
  open(
    parent: DelegationParent,
    counters: DelegationBudgetCounters,
    now: number,
  ) {
    const exact = delegationParentSchema.parse(parent)
    const initial = delegationBudgetCountersSchema.parse(counters)
    delegationTimeSchema.parse(now)
    const key = canonicalCopyJson(exact),
      old = this.snapshot(exact)
    if (old) {
      if (canonicalCopyJson(old.initial) !== canonicalCopyJson(initial))
        throw new DelegationBudgetError(
          'The original task allowance cannot change.',
        )
      return old
    }
    const identity = canonicalCopyJson(exact.identity)
    if (
      this.sql
        .exec(
          'SELECT parent_key FROM delegation_budgets WHERE identity<>? OR task_id=? LIMIT 1',
          identity,
          exact.taskId,
        )
        .toArray().length
    )
      throw new DelegationBudgetError(
        'The task allowance belongs to another identity.',
      )
    const value: DelegationBudgetSnapshot = {
      parent: exact,
      initial,
      used: initial,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    this.sql.exec(
      'INSERT INTO delegation_budgets VALUES(?,?,?,?)',
      key,
      exact.taskId,
      identity,
      JSON.stringify(value),
    )
    return value
  }
  snapshot(parent: DelegationParent): DelegationBudgetSnapshot | undefined {
    const key = canonicalCopyJson(delegationParentSchema.parse(parent))
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM delegation_budgets WHERE parent_key=?',
        key,
      )
      .toArray()[0]
    return row
      ? delegationBudgetSnapshotSchema.parse(JSON.parse(row.json))
      : undefined
  }
  reserve(
    parent: DelegationParent,
    input: DelegationOperation,
    now: number,
  ): DelegationOperationReceipt {
    const exact = delegationParentSchema.parse(parent)
    const operation = delegationOperationSchema.parse(input)
    delegationTimeSchema.parse(now)
    const key = canonicalCopyJson(exact),
      old = this.snapshot(exact)
    if (!old)
      throw new DelegationBudgetError(
        'The shared task allowance is unavailable.',
      )
    const previous = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM delegation_budget_operations WHERE parent_key=? AND id=?',
        key,
        operation.id,
      )
      .toArray()[0]
    if (previous) {
      const receipt = delegationOperationReceiptSchema.parse(
        JSON.parse(previous.json),
      )
      if (canonicalCopyJson(receipt.operation) !== canonicalCopyJson(operation))
        throw new DelegationBudgetError(
          'This operation receipt belongs to another request.',
        )
      return receipt
    }
    if (now < old.updatedAt)
      throw new DelegationBudgetError(
        'Task allowance updates cannot move backward in time.',
      )
    const field = delegationOperationCounter[operation.kind]
    if (old.used[field] >= delegationBudgetLimits[field])
      throw new DelegationBudgetError(
        `The shared task reached its ${operation.kind} limit.`,
      )
    const next = delegationBudgetSnapshotSchema.parse({
      ...old,
      used: { ...old.used, [field]: old.used[field] + 1 },
      version: old.version + 1,
      updatedAt: now,
    })
    const receipt: DelegationOperationReceipt = {
      operation,
      reservedAt: now,
      version: next.version,
      usedAfter: next.used,
    }
    this.sql.exec(
      'INSERT INTO delegation_budget_operations VALUES(?,?,?)',
      key,
      operation.id,
      JSON.stringify(receipt),
    )
    this.sql.exec(
      'UPDATE delegation_budgets SET json=? WHERE parent_key=?',
      JSON.stringify(next),
      key,
    )
    return receipt
  }
}
