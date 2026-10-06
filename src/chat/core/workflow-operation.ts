import { z } from 'zod'
import { assistantLimits } from './assistant-task'

/** Operation limits, not currency estimates. Each run pins its own allowance. */
export const workflowOperationLimitsSchema = z.strictObject({
  model: z
    .number()
    .int()
    .min(1)
    .max(assistantLimits.modelPasses * 32),
  tool: z
    .number()
    .int()
    .min(0)
    .max(assistantLimits.toolCalls * 32),
  repair: z
    .number()
    .int()
    .min(0)
    .max(assistantLimits.repairs * 32),
})
export const workflowOperationSchema = z.strictObject({
  id: z.string().min(1).max(200),
  executionId: z.uuid(),
  kind: z.enum(['model', 'tool', 'repair']),
})
export type WorkflowOperation = z.infer<typeof workflowOperationSchema>
export type WorkflowOperationReceipt = {
  operation: WorkflowOperation
  reservedAt: number
}
