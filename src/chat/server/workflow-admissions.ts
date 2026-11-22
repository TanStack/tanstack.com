import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import { canonicalCopyJson } from '../core/conversation-copy'
import {
  workflowStepAdmissionSchema,
  type WorkflowStepAdmission,
} from '../core/workflow-admission'
import type { WorkflowConversationRunOrigin } from '../core/conversation-runs'
import type { ConversationRuns } from './conversation-runs'

const time = z.number().int().nonnegative().safe()
const receiptSchema = z.strictObject({
  admission: workflowStepAdmissionSchema,
  status: z.enum(['admitted', 'revoked']),
  updatedAt: time,
})

export function workflowRunOrigin(
  admission: WorkflowStepAdmission,
): WorkflowConversationRunOrigin {
  return {
    kind: 'workflow',
    workflowRunId: admission.workflowRunId,
    workflowId: admission.workflowId,
    definitionRevision: admission.definitionRevision,
    stepId: admission.stepId,
    stepExecutionId: admission.id,
    ownerConversationId: admission.owner.conversationId,
  }
}

/** Child-local receipts. Caller must check owning workflow liveness and current
 * access, then commit receipt, run and queued task in one storage transaction.
 * Conversation commits this with its initial task state. Transcript metadata
 * never grants workflow authority. */
export class WorkflowAdmissions {
  constructor(private sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS workflow_admission (singleton INTEGER PRIMARY KEY CHECK(singleton=1),json TEXT NOT NULL)',
    )
  }
  current() {
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM workflow_admission WHERE singleton=1',
      )
      .toArray()[0]
    return row ? receiptSchema.parse(JSON.parse(row.json)) : undefined
  }
  private match(raw: unknown, now: number) {
    const admission = workflowStepAdmissionSchema.parse(raw)
    time.parse(now)
    const previous = this.current()
    if (
      previous &&
      canonicalCopyJson(previous.admission) !== canonicalCopyJson(admission)
    )
      throw Error('This child belongs to another workflow admission.')
    if (now < (previous?.updatedAt ?? admission.createdAt))
      throw Error('Workflow admission time cannot move backwards.')
    return { admission, previous }
  }
  admit(raw: unknown, runs: ConversationRuns, now: number) {
    const { admission, previous } = this.match(raw, now)
    if (previous?.status === 'revoked')
      throw Error('Workflow admission was revoked.')
    const candidate = {
      id: admission.id,
      identity: {
        ...admission.owner,
        conversationId: admission.childConversationId,
      },
      origin: workflowRunOrigin(admission),
      mode: 'assistant' as const,
      status: 'queued' as const,
      createdAt: admission.createdAt,
    }
    if (previous?.status === 'admitted') {
      if (!runs.get(admission.id))
        throw Error('Workflow run receipt is missing.')
      // Existing evidence only, never restart after a lost acknowledgment.
      return runs.accept(candidate)
    }
    if (now >= admission.deadline)
      throw Error('Workflow admission has expired.')
    if (runs.list({ limit: 1 }).items.length)
      throw Error('This conversation already has a run.')
    const run = runs.accept(candidate)
    this.write({ admission, status: 'admitted', updatedAt: now })
    return run
  }
  revoke(raw: unknown, now: number) {
    const { admission, previous } = this.match(raw, now)
    if (previous?.status === 'revoked') return previous
    return this.write({ admission, status: 'revoked', updatedAt: now })
  }
  private write(receipt: z.infer<typeof receiptSchema>) {
    const parsed = receiptSchema.parse(receipt)
    this.sql.exec(
      'INSERT INTO workflow_admission VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET json=excluded.json',
      JSON.stringify(parsed),
    )
    return parsed
  }
}
