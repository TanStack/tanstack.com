import { z } from 'zod'
import type { WorkflowUsage } from './workflow-usage'
import { workflowRunStatus, type WorkflowRun } from './workflow-runs'
import { workflowStepIdSchema } from './workflows'
export const workflowAnswerReadSchema = z.strictObject({
  runId: z.uuid(),
  stepId: workflowStepIdSchema,
  offset: z.number().int().nonnegative().safe().default(0),
})
export const workflowOutputFileReadSchema = workflowAnswerReadSchema.extend({
  fileId: z.uuid(),
})
export const workflowRunListSchema = z.strictObject({
  limit: z.number().int().min(1).max(25).default(10),
  after: z
    .strictObject({
      createdAt: z.number().int().nonnegative().safe(),
      id: z.uuid(),
    })
    .optional(),
})
export function workflowRunSummary(run: WorkflowRun) {
  return {
    id: run.request.id,
    workflowId: run.request.workflowId,
    revision: run.request.definitionRevision,
    name: run.request.definition.name,
    status: workflowRunStatus(run),
    createdAt: run.request.createdAt,
    updatedAt: run.updatedAt,
    deadline: run.request.deadline,
    completedSteps: run.steps.filter((step) => step.status === 'completed')
      .length,
    totalSteps: run.steps.length,
    model: run.request.model,
  }
}

export type WorkflowRunSummary = ReturnType<typeof workflowRunSummary>
export interface WorkflowRunInspection {
  run: WorkflowRun
  summary: WorkflowRunSummary
  usage?: WorkflowUsage
  orchestration: {
    launchState: string
    attempts: number
    nextAttemptAt?: number
    platformStatus?: string
    platformUnavailable: boolean
    needsAttention: boolean
  }
}

/** Keep execution internals out of repeated model context. Definitions and
 * outputs have separate readers; status alone never proves output content. */
export function workflowAssistantInspection(value: WorkflowRunInspection) {
  return {
    summary: value.summary,
    steps: value.run.steps.map((step) => ({
      id: step.id,
      name: value.run.request.definition.steps.find(
        (item) => item.id === step.id,
      )?.name,
      status: step.status,
      ...(step.result && step.result.status !== 'completed'
        ? { reason: step.result.reason }
        : {}),
    })),
    ...(value.run.cancelReason ? { cancelReason: value.run.cancelReason } : {}),
    usage: value.usage,
    orchestration: value.orchestration,
  }
}
