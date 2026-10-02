import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import {
  delegationAdmissionSchema,
  type DelegationAdmission,
} from '../core/delegation'
import { canonicalCopyJson } from '../core/conversation-copy'
import {
  acceptConversationRunSchema,
  type AcceptConversationRun,
  type DelegatedConversationRunOrigin,
} from '../core/conversation-runs'
import type { ConversationRuns } from './conversation-runs'

const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const receiptSchema = z
  .object({
    admission: delegationAdmissionSchema,
    status: z.enum(['prepared', 'admitted', 'revoked', 'rejected']),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    updatedAt: time,
    admittedAt: time.optional(),
    revokedAt: time.optional(),
    rejectedAt: time.optional(),
  })
  .strict()
export type DelegatedAdmissionReceipt = z.infer<typeof receiptSchema>

export class DelegatedAdmissionError extends Error {}

export function delegatedRunOrigin(
  admission: DelegationAdmission,
): DelegatedConversationRunOrigin {
  return {
    kind: 'delegation',
    delegationId: admission.id,
    parentConversationId: admission.parent.identity.conversationId,
    parentRunId: admission.parent.runId,
    parentTaskId: admission.parent.taskId,
    parentEpoch: admission.parent.epoch,
  }
}

/** Child-local admission receipts, not authority to execute a task.
 * The host must authorize both conversations and the live parent grant before
 * calling. Mutations compose with the caller's storage.transactionSync, so
 * admission, run and queue/state publication commit together. Never clear these
 * receipts on transcript reset. A revocation prevents late admission, but does
 * not claim an already-started model, tool or external effect has stopped.
 */
export class DelegatedAdmissions {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS delegated_admissions (
      id TEXT PRIMARY KEY, child_conversation_id TEXT NOT NULL, json TEXT NOT NULL
    )`)
  }

  get(id: string): DelegatedAdmissionReceipt | undefined {
    const parsed = z.string().uuid().parse(id)
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM delegated_admissions WHERE id=?',
        parsed,
      )
      .toArray()[0]
    return row ? receiptSchema.parse(JSON.parse(row.json)) : undefined
  }
  current(): DelegatedAdmissionReceipt | undefined {
    const row = this.sql
      .exec<{ json: string }>('SELECT json FROM delegated_admissions LIMIT 1')
      .toArray()[0]
    return row ? receiptSchema.parse(JSON.parse(row.json)) : undefined
  }

  prepare(input: DelegationAdmission, now: number): DelegatedAdmissionReceipt {
    const admission = delegationAdmissionSchema.parse(input)
    const old = this.match(admission)
    this.checkTime(admission, old, now)
    if (old) return old
    if (now >= admission.deadline)
      throw new DelegatedAdmissionError('This delegated task has expired.')
    const receipt: DelegatedAdmissionReceipt = {
      admission,
      status: 'prepared',
      version: 1,
      updatedAt: now,
    }
    this.write(receipt)
    return receipt
  }

  admit(
    input: DelegationAdmission,
    candidate: AcceptConversationRun,
    runs: ConversationRuns,
    now: number,
  ) {
    const admission = delegationAdmissionSchema.parse(input)
    const old = this.match(admission)
    this.checkTime(admission, old, now)
    if (!old)
      throw new DelegatedAdmissionError('Prepare this delegated task first.')
    if (old.status === 'rejected')
      throw new DelegatedAdmissionError('This delegated task was rejected.')
    if (old.status === 'revoked')
      throw new DelegatedAdmissionError('This delegated task was revoked.')
    const run = acceptConversationRunSchema.parse(candidate)
    const identity = {
      ...admission.parent.identity,
      conversationId: admission.childConversationId,
    }
    if (
      run.id !== admission.id ||
      run.mode !== 'assistant' ||
      run.createdAt !== admission.createdAt ||
      canonicalCopyJson(run.identity) !== canonicalCopyJson(identity) ||
      canonicalCopyJson(run.origin) !==
        canonicalCopyJson(delegatedRunOrigin(admission))
    )
      throw new DelegatedAdmissionError(
        'The delegated run does not match its admission.',
      )
    // A lost acknowledgment must not relaunch work, even after its deadline.
    // The existing run is evidence only; its runtime rechecks current authority.
    if (old.status === 'admitted') {
      const existing = runs.get(admission.id)
      if (!existing)
        throw new DelegatedAdmissionError(
          'The delegated run receipt is missing.',
        )
      return runs.accept(run)
    }
    if (now >= admission.deadline)
      throw new DelegatedAdmissionError('This delegated task has expired.')
    if (runs.list({ limit: 1 }).items.length)
      throw new DelegatedAdmissionError(
        'This conversation already admitted another run.',
      )
    const accepted = runs.accept(run)
    this.write({
      ...old,
      status: 'admitted',
      version: old.version + 1,
      updatedAt: now,
      admittedAt: now,
    })
    return accepted
  }

  /** Record a terminal admission conflict without granting execution authority.
   * The caller checks the live parent grant and commits the public failure report
   * in the same transaction. Existing manual runs and transcript stay untouched. */
  rejectOccupied(
    input: DelegationAdmission,
    runs: ConversationRuns,
    now: number,
  ) {
    const admission = delegationAdmissionSchema.parse(input)
    const old = this.match(admission)
    this.checkTime(admission, old, now)
    const existing = runs.get(admission.id)
    if (old?.status === 'rejected' && existing) return existing
    if (old?.status === 'revoked' || old?.status === 'admitted' || existing)
      throw new DelegatedAdmissionError('This delegation cannot be rejected.')
    if (now >= admission.deadline)
      throw new DelegatedAdmissionError('This delegated task has expired.')
    if (!runs.list({ limit: 1 }).items.length)
      throw new DelegatedAdmissionError('No conflicting run was found.')
    runs.accept({
      id: admission.id,
      identity: {
        ...admission.parent.identity,
        conversationId: admission.childConversationId,
      },
      origin: delegatedRunOrigin(admission),
      mode: 'assistant',
      status: 'queued',
      createdAt: admission.createdAt,
    })
    const rejected = runs.update(admission.id, {
      status: 'failed',
      completedAt: now,
      updatedAt: now,
    })
    this.write({
      admission,
      status: 'rejected',
      version: (old?.version ?? 0) + 1,
      updatedAt: now,
      rejectedAt: now,
    })
    return rejected
  }

  revoke(input: DelegationAdmission, now: number): DelegatedAdmissionReceipt {
    const admission = delegationAdmissionSchema.parse(input)
    const old = this.match(admission)
    this.checkTime(admission, old, now)
    if (old?.status === 'revoked') return old
    const receipt: DelegatedAdmissionReceipt = {
      ...(old ?? { admission, version: 0, updatedAt: now }),
      status: 'revoked',
      version: (old?.version ?? 0) + 1,
      updatedAt: now,
      revokedAt: now,
    }
    this.write(receipt)
    return receipt
  }

  private match(admission: DelegationAdmission) {
    const old = this.get(admission.id)
    if (
      old &&
      canonicalCopyJson(old.admission) !== canonicalCopyJson(admission)
    )
      throw new DelegatedAdmissionError(
        'This delegation ID belongs to a different request.',
      )
    const other = this.sql
      .exec(
        'SELECT id FROM delegated_admissions WHERE id<>? LIMIT 1',
        admission.id,
      )
      .toArray()
    // A delegated thread starts with one child task. Later manual turns use the
    // ordinary run path and must never become targets for the original parent.
    if (other.length)
      throw new DelegatedAdmissionError(
        'This conversation already has a delegated task.',
      )
    return old
  }

  private checkTime(
    admission: DelegationAdmission,
    receipt: DelegatedAdmissionReceipt | undefined,
    now: number,
  ) {
    time.parse(now)
    if (now < (receipt?.updatedAt ?? admission.createdAt))
      throw new DelegatedAdmissionError(
        'Delegation updates cannot move backward in time.',
      )
  }

  private write(receipt: DelegatedAdmissionReceipt) {
    const parsed = receiptSchema.parse(receipt)
    this.sql.exec(
      `INSERT INTO delegated_admissions VALUES(?,?,?)
       ON CONFLICT(id) DO UPDATE SET json=excluded.json`,
      parsed.admission.id,
      parsed.admission.childConversationId,
      JSON.stringify(parsed),
    )
  }
}
