import { z } from 'zod'
import {
  actionEvidenceInventory,
  maxActionEvidenceRecords,
  type ActionEvidence,
} from './retry-source'

/** Evidence owned by this exact destination, independent of its retry editor. */
export interface ActionEvidenceView {
  operationId: string | null
  currentEvidenceId?: string
  records: ActionEvidence[]
}

const responseSchema = z
  .object({
    operationId: z.string().min(1).max(200).nullable(),
    currentEvidenceId: z.string().min(1).max(200).optional(),
    records: z.array(z.unknown()).max(maxActionEvidenceRecords),
  })
  .strict()

export function parseActionEvidenceView(
  value: unknown,
  expectedOperationId: string | null,
): ActionEvidenceView {
  const parsed = responseSchema.parse(value)
  if (parsed.operationId !== expectedOperationId)
    throw new Error(
      'This conversation changed. Check its action history again.',
    )
  const records = parsed.records as ActionEvidence[]
  actionEvidenceInventory(records)
  if (
    (parsed.operationId === null && records.length > 0) ||
    (parsed.currentEvidenceId !== undefined &&
      (parsed.currentEvidenceId !== parsed.operationId ||
        !records.some((record) => record.id === parsed.currentEvidenceId)))
  )
    throw new Error('The previous attempt could not be verified.')
  return {
    operationId: parsed.operationId,
    ...(parsed.currentEvidenceId !== undefined
      ? { currentEvidenceId: parsed.currentEvidenceId }
      : {}),
    records,
  }
}
