import { z } from 'zod'

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

/** Framework JSON sizes at one prepared model-pass boundary. These are neither
 * provider wire bytes nor token counts. Usage attempts separately prove dispatch. */
export const contextObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    scope: z.literal('assistant-history'),
    stage: z.literal('prepared'),
    unit: z.literal('utf8-json-bytes'),
    observedAt: count,
    transcriptEpoch: z.string().min(1).max(128),
    runId: z.string().min(1).max(128),
    phase: z.enum(['beforeModel', 'structuredOutput']),
    history: z
      .object({
        budgetBytes: count.positive(),
        /** Incoming history before this pass's compaction, including init on pass one. */
        inputBytes: count,
        retainedBytes: count,
        inputMessages: count,
        retainedMessages: count,
        /** Removed messages replaced by a reference, not deleted from stored history. */
        compactedMessages: count,
        archivedLargeMessages: count,
        pinnedEvidenceMessages: count,
      })
      .strict(),
    request: z
      .object({
        systemPromptBytes: count,
        toolDefinitionBytes: count,
        systemPrompts: count,
        tools: count,
        mediaParts: count,
        attachmentPayloadMessages: count,
        outputSchemaBytes: count.optional(),
      })
      .strict(),
    exclusions: z.tuple([
      z.literal('media-payloads'),
      z.literal('attachment-payloads'),
    ]),
  })
  .strict()

export type ContextObservation = z.infer<typeof contextObservationSchema>

/** Old ledgers and invalid observations are unavailable, never a zero reading. */
export function parseContextObservation(value: unknown) {
  const parsed = contextObservationSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
