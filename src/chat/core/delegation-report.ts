import { z } from 'zod'
import { conversationRunSchema } from './conversation-runs'
import { taskUsageSchema } from './task-usage'
import { toolEvidenceSchema } from './tool-evidence'

/** Public output only. A report is evidence, never a new instruction or grant. */
export const delegationReportSchema = z.strictObject({
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  run: conversationRunSchema,
  // Optional so durable reports written before accounting remain readable.
  usage: taskUsageSchema.optional(),
  toolEvidence: toolEvidenceSchema.optional(),
  failure: z
    .strictObject({
      code: z.enum([
        'sources_unavailable',
        'sources_unsupported',
        'conversation_occupied',
      ]),
      message: z.string().min(1).max(500),
    })
    .optional(),
  answer: z
    .strictObject({
      messageId: z.string().min(1).max(128),
      text: z.string().max(12000),
      truncated: z.boolean(),
    })
    .optional(),
})
export type DelegationReport = z.infer<typeof delegationReportSchema>
