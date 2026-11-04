import { z } from 'zod'
import type { UIMessage } from '@tanstack/ai'
import { workflowStepIdSchema } from './workflows'

const id = z.string().min(1).max(128)
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const conversationRunStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'waiting_user',
  'waiting_children',
  'completed',
  'incomplete',
  'interrupted',
  'cancelled',
  'failed',
])
export const conversationRunIdentitySchema = z
  .object({
    workspaceId: z.string().min(1).max(1000),
    userId: z.string().min(1).max(1000),
    botId: z.string().min(1).max(1000),
    conversationId: z.string().min(1).max(1000),
  })
  .strict()
export const scheduledConversationRunOriginSchema = z
  .object({
    kind: z.literal('schedule'),
    scheduleId: z.string().uuid(),
    revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    occurrenceId: z.string().uuid(),
  })
  .strict()
export type ScheduledConversationRunOrigin = z.infer<
  typeof scheduledConversationRunOriginSchema
>
export const delegatedConversationRunOriginSchema = z
  .object({
    kind: z.literal('delegation'),
    delegationId: z.string().uuid(),
    parentConversationId: z.string().min(1).max(1000),
    parentRunId: id,
    parentTaskId: id,
    parentEpoch: z.string().min(1).max(1000),
  })
  .strict()
export type DelegatedConversationRunOrigin = z.infer<
  typeof delegatedConversationRunOriginSchema
>
export const workflowConversationRunOriginSchema = z.strictObject({
  kind: z.literal('workflow'),
  workflowRunId: z.uuid(),
  workflowId: z.uuid(),
  definitionRevision: z.number().int().positive().safe(),
  stepId: workflowStepIdSchema,
  stepExecutionId: z.uuid(),
  ownerConversationId: z.string().min(1).max(1000),
})
export type WorkflowConversationRunOrigin = z.infer<
  typeof workflowConversationRunOriginSchema
>
export const conversationRunOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), messageId: id }).strict(),
  scheduledConversationRunOriginSchema,
  delegatedConversationRunOriginSchema,
  workflowConversationRunOriginSchema,
])
export type ConversationRunOrigin = z.infer<typeof conversationRunOriginSchema>
/** The host uses this stable ID for the initiating message and task. */
export function initiatingRunMessageId(run: { origin: ConversationRunOrigin }) {
  switch (run.origin.kind) {
    case 'user':
      return run.origin.messageId
    case 'schedule':
      return run.origin.occurrenceId
    case 'delegation':
      return run.origin.delegationId
    case 'workflow':
      return run.origin.stepExecutionId
  }
}
export function readScheduledRunOrigin(
  message: Pick<UIMessage, 'id' | 'metadata'>,
): ScheduledConversationRunOrigin | undefined {
  const origin = scheduledConversationRunOriginSchema.safeParse(
    message.metadata?.gumOrigin,
  )
  return origin.success && origin.data.occurrenceId === message.id
    ? origin.data
    : undefined
}
/** Validated host-authored provenance, retained as history without granting authority. */
export function readAutomatedRunOrigin(
  message: Pick<UIMessage, 'id' | 'metadata'>,
) {
  return (
    readScheduledRunOrigin(message) ??
    readDelegatedRunOrigin(message) ??
    readWorkflowRunOrigin(message)
  )
}
export function readWorkflowRunOrigin(
  message: Pick<UIMessage, 'id' | 'metadata'>,
): WorkflowConversationRunOrigin | undefined {
  const origin = workflowConversationRunOriginSchema.safeParse(
    message.metadata?.gumOrigin,
  )
  return origin.success && origin.data.stepExecutionId === message.id
    ? origin.data
    : undefined
}
export function readDelegatedRunOrigin(
  message: Pick<UIMessage, 'id' | 'metadata'>,
): DelegatedConversationRunOrigin | undefined {
  const origin = delegatedConversationRunOriginSchema.safeParse(
    message.metadata?.gumOrigin,
  )
  return origin.success && origin.data.delegationId === message.id
    ? origin.data
    : undefined
}
const conversationRunRecordSchema = z
  .object({
    id,
    identity: conversationRunIdentitySchema,
    origin: conversationRunOriginSchema,
    mode: z.enum(['assistant', 'system-one', 'tools']),
    createdAt: time,
    updatedAt: time,
    status: conversationRunStatusSchema,
    startedAt: time.optional(),
    completedAt: time.optional(),
    assistantTaskId: id.optional(),
    executionId: id.optional(),
  })
  .strict()
const hasInitiatingRunId = (run: {
  id: string
  origin: ConversationRunOrigin
}) => run.id === initiatingRunMessageId(run)
const initiatingRunIdError =
  'Run ID must match the initiating message, occurrence, delegation or workflow step.'
export const conversationRunSchema = conversationRunRecordSchema.refine(
  hasInitiatingRunId,
  initiatingRunIdError,
)
export type ConversationRun = z.infer<typeof conversationRunSchema>
export type ConversationRunStatus = ConversationRun['status']
/** Host-owned result, independent of model-written completion claims. */
export type ConversationRunOutcome = {
  runId: string
  status: 'completed' | 'incomplete' | 'interrupted' | 'failed'
}
export const acceptConversationRunSchema = conversationRunRecordSchema
  .omit({ updatedAt: true, completedAt: true })
  .extend({ status: z.enum(['queued', 'running']) })
  .refine(hasInitiatingRunId, initiatingRunIdError)
export type AcceptConversationRun = z.infer<typeof acceptConversationRunSchema>
export const conversationRunPatchSchema = conversationRunRecordSchema
  .pick({
    status: true,
    startedAt: true,
    assistantTaskId: true,
    executionId: true,
    updatedAt: true,
  })
  .partial()
  .extend({ completedAt: time.nullable().optional() })
  .strict()
export type ConversationRunPatch = z.infer<typeof conversationRunPatchSchema>
export const conversationRunPageSchema = z
  .object({
    items: z.array(conversationRunSchema).max(50),
    nextCursor: z.string().optional(),
  })
  .strict()
export type ConversationRunPage = z.infer<typeof conversationRunPageSchema>
export const terminalRunStatuses: ReadonlySet<ConversationRunStatus> = new Set([
  'completed',
  'incomplete',
  'interrupted',
  'cancelled',
  'failed',
])
