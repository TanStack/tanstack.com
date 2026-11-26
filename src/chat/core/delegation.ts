import { z } from 'zod'
import { conversationRunIdentitySchema } from './conversation-runs'
import { threadSourceSchema } from './conversation-threads'
import { runModelSchema } from './run-model'
import { delegationSourcesSchema } from './delegation-sources'

export const maxDelegationChildren = 4
export const maxConcurrentDelegations = 2
export const maxDelegationLifetimeMs = 30 * 60 * 1000
export const maxPendingDelegationBatch = 100

const id = z.string().min(1).max(128)
export const delegationTimeSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
export const delegationParentSchema = z.strictObject({
  identity: conversationRunIdentitySchema,
  runId: id,
  taskId: id,
  epoch: z.string().min(1).max(1000),
})
const admissionFields = {
  id: z.uuid(),
  parent: delegationParentSchema,
  childConversationId: z.uuid(),
  objective: z.string().trim().min(1).max(6000),
  context: z.string().max(12000),
  sources: delegationSourcesSchema.optional(),
  sourceMessageId: id,
  source: threadSourceSchema.extend({ role: z.literal('user') }),
  model: runModelSchema,
  createdAt: delegationTimeSchema,
  deadline: delegationTimeSchema,
}
function validAdmission(value: {
  parent: { identity: { conversationId: string }; runId: string; epoch: string }
  childConversationId: string
  sourceMessageId: string
  source: { epoch: string }
  createdAt: number
  deadline: number
}) {
  return (
    value.childConversationId !== value.parent.identity.conversationId &&
    value.sourceMessageId === value.parent.runId &&
    value.source.epoch === value.parent.epoch &&
    value.deadline > value.createdAt &&
    value.deadline - value.createdAt <= maxDelegationLifetimeMs
  )
}
export const delegationAdmissionSchema = z
  .strictObject(admissionFields)
  .refine(validAdmission, 'Invalid delegation identity, source or deadline.')

export const delegationRecordSchema = z
  .strictObject({
    ...admissionFields,
    status: z.enum([
      'pending',
      'dispatching',
      'admitted',
      'settled',
      'cancelling',
      'cancelled',
    ]),
    version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    updatedAt: delegationTimeSchema,
    dispatchedAt: delegationTimeSchema.optional(),
    admittedAt: delegationTimeSchema.optional(),
    settledAt: delegationTimeSchema.optional(),
    cancelRequestedAt: delegationTimeSchema.optional(),
    cancelledAt: delegationTimeSchema.optional(),
  })
  .refine(validAdmission, 'Invalid delegation identity, source or deadline.')
  .refine((value) => {
    if (value.updatedAt < value.createdAt) return false
    if (
      value.dispatchedAt !== undefined &&
      (value.dispatchedAt < value.createdAt ||
        value.dispatchedAt >= value.deadline ||
        value.dispatchedAt > value.updatedAt)
    )
      return false
    if (
      value.admittedAt !== undefined &&
      (value.dispatchedAt === undefined ||
        value.admittedAt < value.dispatchedAt ||
        value.admittedAt >= value.deadline ||
        value.admittedAt > value.updatedAt)
    )
      return false
    if (
      value.cancelRequestedAt !== undefined &&
      (value.cancelRequestedAt <
        (value.admittedAt ?? value.dispatchedAt ?? value.createdAt) ||
        value.cancelRequestedAt > value.updatedAt)
    )
      return false
    if (
      value.cancelledAt !== undefined &&
      (value.cancelRequestedAt === undefined ||
        value.cancelledAt < value.cancelRequestedAt ||
        value.cancelledAt > value.updatedAt)
    )
      return false
    if (value.status === 'settled')
      return (
        value.dispatchedAt !== undefined &&
        value.settledAt !== undefined &&
        value.cancelledAt === undefined &&
        value.settledAt >=
          (value.cancelRequestedAt ?? value.admittedAt ?? value.dispatchedAt) &&
        value.settledAt <= value.updatedAt
      )
    if (value.settledAt !== undefined) return false
    if (value.status === 'pending')
      return (
        value.dispatchedAt === undefined &&
        value.admittedAt === undefined &&
        value.cancelRequestedAt === undefined &&
        value.cancelledAt === undefined
      )
    if (value.status === 'dispatching')
      return (
        value.dispatchedAt !== undefined &&
        value.admittedAt === undefined &&
        value.cancelRequestedAt === undefined &&
        value.cancelledAt === undefined
      )
    if (value.status === 'admitted')
      return (
        value.admittedAt !== undefined &&
        value.cancelRequestedAt === undefined &&
        value.cancelledAt === undefined
      )
    if (value.status === 'cancelling')
      return (
        value.cancelRequestedAt !== undefined && value.cancelledAt === undefined
      )
    return (
      value.cancelRequestedAt !== undefined && value.cancelledAt !== undefined
    )
  }, 'Invalid delegation lifecycle timestamps.')

export type DelegationParent = z.infer<typeof delegationParentSchema>
export type DelegationAdmission = z.infer<typeof delegationAdmissionSchema>
export type DelegationRecord = z.infer<typeof delegationRecordSchema>
