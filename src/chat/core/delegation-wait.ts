import { z } from 'zod'
import {
  delegationParentSchema,
  delegationTimeSchema,
  maxDelegationChildren,
} from './delegation'

export const delegationWaitRequestSchema = z.strictObject({
  id: z.uuid(),
  parent: delegationParentSchema,
  toolCallId: z.string().min(1).max(128),
  delegationIds: z
    .array(z.uuid())
    .min(1)
    .max(maxDelegationChildren)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Include each child once.',
    )
    .transform((ids) => [...ids].sort()),
  createdAt: delegationTimeSchema,
})
export const delegationWaitSchema = z
  .strictObject({
    ...delegationWaitRequestSchema.shape,
    status: z.enum(['waiting', 'resumed', 'cancelled']),
    updatedAt: delegationTimeSchema,
    executionId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      value.updatedAt >= value.createdAt &&
      (value.status === 'resumed'
        ? value.executionId !== undefined
        : value.executionId === undefined),
    'Invalid wait transition.',
  )
export type DelegationWaitRequest = z.input<typeof delegationWaitRequestSchema>
export type DelegationWait = z.infer<typeof delegationWaitSchema>
