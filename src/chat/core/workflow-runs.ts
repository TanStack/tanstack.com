import { z } from 'zod'
import { workflowDefinitionSchema } from './workflows'
import { conversationRunIdentitySchema } from './conversation-runs'
import { runModelSchema } from './run-model'
import { delegationSourcesSchema } from './delegation-sources'
import type { WorkflowStepAdmission } from './workflow-admission'
import {
  workflowOperationLimitsSchema,
  type WorkflowOperationReceipt,
} from './workflow-operation'

const time = z.number().int().nonnegative().safe()
export const workflowRunRequestSchema = z
  .strictObject({
    id: z.uuid(),
    workflowId: z.uuid(),
    definitionRevision: z.number().int().positive().safe(),
    definition: workflowDefinitionSchema,
    scope: conversationRunIdentitySchema,
    model: runModelSchema,
    sources: delegationSourcesSchema.default([]),
    operationLimits: workflowOperationLimitsSchema,
    triggerId: z.string().min(1).max(200),
    createdAt: time,
    deadline: time,
    concurrency: z.number().int().min(1).max(4).default(2),
  })
  .refine(
    (run) => run.deadline > run.createdAt,
    'The deadline must follow creation.',
  )
export type WorkflowRunRequest = z.infer<typeof workflowRunRequestSchema>
export type WorkflowStepResult =
  | { status: 'completed'; resultId: string }
  | { status: 'failed' | 'cancelled'; reason: string }
/** References identify evidence only. Reading it still requires current access. */
export type WorkflowStepInput = {
  name: string
  fromStep: string
  output: 'answer' | 'files'
  executionId: string
  resultId: string
}
export type WorkflowStepState = {
  id: string
  status: 'pending' | 'dispatched' | 'completed' | 'failed' | 'cancelled'
  executionId?: string
  inputs?: WorkflowStepInput[]
  admission?: WorkflowStepAdmission
  result?: WorkflowStepResult
}
export type WorkflowRun = {
  request: WorkflowRunRequest
  steps: WorkflowStepState[]
  operations: WorkflowOperationReceipt[]
  cancelReason?: 'user' | 'deadline'
  updatedAt: number
}
export const workflowStepResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('completed'),
    resultId: z.string().min(1).max(200),
  }),
  z.strictObject({
    status: z.literal('failed'),
    reason: z.string().min(1).max(500),
  }),
  z.strictObject({
    status: z.literal('cancelled'),
    reason: z.string().min(1).max(500),
  }),
])
export function workflowRunStatus(run: WorkflowRun) {
  const active = run.steps.some((step) => step.status === 'dispatched')
  if (run.cancelReason) return active ? 'cancelling' : 'cancelled'
  if (
    run.steps.some(
      (step) => step.status === 'failed' || step.status === 'cancelled',
    )
  )
    return active ? 'stopping' : 'failed'
  return run.steps.every((step) => step.status === 'completed')
    ? 'completed'
    : 'running'
}
export function readyWorkflowSteps(run: WorkflowRun) {
  if (workflowRunStatus(run) !== 'running') return []
  const remaining =
    run.request.concurrency -
    run.steps.filter((step) => step.status === 'dispatched').length
  const complete = new Set(
    run.steps
      .filter((step) => step.status === 'completed')
      .map((step) => step.id),
  )
  const pending = new Set(
    run.steps
      .filter((step) => step.status === 'pending')
      .map((step) => step.id),
  )
  return run.request.definition.steps
    .filter(
      (step) =>
        pending.has(step.id) && step.dependsOn.every((id) => complete.has(id)),
    )
    .slice(0, Math.max(0, remaining))
    .map((step) => step.id)
}
