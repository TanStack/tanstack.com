import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import type { UIMessage } from '@tanstack/ai'
import {
  conversationRunSchema,
  type ConversationRun,
} from '../core/conversation-runs'
import { workflowStepAdmissionSchema } from '../core/workflow-admission'
import {
  fileDeliverySchema,
  readFileDeliveries,
  fileDeliveryKey,
} from '../core/file-deliveries'
import { canonicalCopyJson } from '../core/conversation-copy'
import { workflowRunOrigin } from './workflow-admissions'

export const workflowResultSchema = z
  .strictObject({
    id: z.uuid(),
    run: conversationRunSchema,
    answer: z
      .strictObject({ messageId: z.string().min(1).max(128), text: z.string() })
      .optional(),
    files: z.array(fileDeliverySchema),
  })
  .refine(
    (result) =>
      result.id === result.run.id &&
      result.run.origin.kind === 'workflow' &&
      ['completed', 'failed', 'cancelled'].includes(result.run.status) &&
      (result.run.status === 'completed' || result.answer === undefined),
    'Workflow results require a settled workflow run.',
  )
export type WorkflowResult = z.infer<typeof workflowResultSchema>

function assertWorkflowResultRun(rawAdmission: unknown, run: ConversationRun) {
  const admission = workflowStepAdmissionSchema.parse(rawAdmission)
  if (
    run.id !== admission.id ||
    run.mode !== 'assistant' ||
    run.createdAt !== admission.createdAt ||
    canonicalCopyJson(run.identity) !==
      canonicalCopyJson({
        ...admission.owner,
        conversationId: admission.childConversationId,
      }) ||
    canonicalCopyJson(run.origin) !==
      canonicalCopyJson(workflowRunOrigin(admission))
  )
    throw Error('Workflow result does not match its admission.')
}
export function workflowResultForAdmission(
  rawAdmission: unknown,
  rawResult: unknown,
) {
  const result = workflowResultSchema.parse(rawResult)
  assertWorkflowResultRun(rawAdmission, result.run)
  return result
}

/** Child-local immutable public outputs. No reasoning parts, credentials or
 * tool result bodies are stored. File references still require current access. */
export class WorkflowResults {
  constructor(private sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS workflow_results(id TEXT PRIMARY KEY,json TEXT NOT NULL)',
    )
  }
  get(id: string): WorkflowResult | undefined {
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM workflow_results WHERE id=?',
        z.uuid().parse(id),
      )
      .toArray()[0]
    return row ? workflowResultSchema.parse(JSON.parse(row.json)) : undefined
  }
  capture(
    rawAdmission: unknown,
    run: ConversationRun,
    messages: UIMessage[],
    answerId?: string,
  ) {
    const admission = workflowStepAdmissionSchema.parse(rawAdmission)
    assertWorkflowResultRun(admission, run)
    const old = this.get(run.id)
    if (old) return old
    if (!['completed', 'failed', 'cancelled'].includes(run.status)) return
    const start = messages.findIndex(
      (message) => message.id === run.id && message.role === 'user',
    )
    if (start < 0) return // No invented output after missing/reset transcript.
    const later = messages.slice(start + 1)
    const nextUser = later.findIndex((message) => message.role === 'user')
    const turn = nextUser < 0 ? later : later.slice(0, nextUser)
    const answer =
      run.status === 'completed'
        ? turn.find(
            (message) =>
              message.id === answerId && message.role === 'assistant',
          )
        : undefined
    const files = new Map<string, z.infer<typeof fileDeliverySchema>>()
    for (const message of turn)
      for (const file of readFileDeliveries(message))
        files.set(fileDeliveryKey(file), file)
    const result = workflowResultSchema.parse({
      id: run.id,
      run,
      ...(answer
        ? {
            answer: {
              messageId: answer.id,
              text: answer.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.content)
                .join('\n'),
            },
          }
        : {}),
      files: [...files.values()],
    })
    this.sql.exec(
      'INSERT INTO workflow_results VALUES(?,?)',
      result.id,
      JSON.stringify(result),
    )
    return result
  }
}
