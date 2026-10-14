import { z } from 'zod'
import { assistantLimits } from './assistant-task'
import { delegationParentSchema, delegationTimeSchema } from './delegation'

export const delegationBudgetLimits = {
  modelPasses: assistantLimits.modelPasses,
  toolCalls: assistantLimits.toolCalls,
  repairs: assistantLimits.repairs,
} as const
export const delegationBudgetCountersSchema = z.strictObject({
  modelPasses: z.number().int().min(0).max(delegationBudgetLimits.modelPasses),
  toolCalls: z.number().int().min(0).max(delegationBudgetLimits.toolCalls),
  repairs: z.number().int().min(0).max(delegationBudgetLimits.repairs),
})
export const delegationOperationSchema = z.strictObject({
  id: z.string().min(1).max(200),
  kind: z.enum(['model', 'tool', 'repair']),
  delegationId: z.uuid().nullable(),
  amount: z.literal(1),
})
export const delegationBudgetSnapshotSchema = z
  .strictObject({
    parent: delegationParentSchema,
    initial: delegationBudgetCountersSchema,
    used: delegationBudgetCountersSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    createdAt: delegationTimeSchema,
    updatedAt: delegationTimeSchema,
  })
  .refine(
    (value) =>
      value.updatedAt >= value.createdAt &&
      Object.keys(delegationBudgetLimits).every((key) => {
        const field = key as keyof typeof delegationBudgetLimits
        return value.used[field] >= value.initial[field]
      }),
    'Invalid delegation budget counters or timestamps.',
  )
export const delegationOperationReceiptSchema = z.strictObject({
  operation: delegationOperationSchema,
  reservedAt: delegationTimeSchema,
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  usedAfter: delegationBudgetCountersSchema,
})
export type DelegationBudgetCounters = z.infer<
  typeof delegationBudgetCountersSchema
>
export type DelegationOperation = z.infer<typeof delegationOperationSchema>
export type DelegationBudgetSnapshot = z.infer<
  typeof delegationBudgetSnapshotSchema
>
export type DelegationOperationReceipt = z.infer<
  typeof delegationOperationReceiptSchema
>

export const delegationOperationCounter = {
  model: 'modelPasses',
  tool: 'toolCalls',
  repair: 'repairs',
} as const satisfies Record<
  DelegationOperation['kind'],
  keyof DelegationBudgetCounters
>
