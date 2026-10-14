import { z } from 'zod'
import { runModelSchema } from './run-model'
import { workflowOperationLimitsSchema } from './workflow-operation'
import { referenceInputsSchema } from './message-references'

/** Manual start options. Identity, definitions and source grants are host-owned. */
export const workflowStartSchema = z.strictObject({
  commandId: z.uuid(),
  workflowId: z.uuid(),
  revision: z.number().int().positive().safe(),
  model: runModelSchema,
  references: referenceInputsSchema
    .default([])
    .refine(
      (items) =>
        items.every(
          (item) => item.kind === 'file' || item.kind === 'conversation',
        ),
      'Select file or conversation references for workflow context.',
    ),
  concurrency: z.number().int().min(1).max(4).default(2),
  durationMs: z.number().int().min(60_000).max(86_400_000).default(1_800_000),
  operationLimits: workflowOperationLimitsSchema,
})
export type WorkflowStart = z.infer<typeof workflowStartSchema>
