import { z } from 'zod'

// Ownership and provenance are resolved by the authenticated service, never input.
export const memoryDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(8000),
    expiresAt: z.number().int().nonnegative().safe().nullable().default(null),
  })
  .strict()
const identity = {
  id: z.string().uuid(),
  commandId: z.string().uuid(),
}
const revision = z.number().int().positive().safe()
export const memoryCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...identity,
      type: z.literal('create'),
      document: memoryDocumentSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('update'),
      expectedRevision: revision,
      document: memoryDocumentSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('delete'),
      expectedRevision: revision,
    })
    .strict(),
])
export const memoryListSchema = z
  .object({
    query: z.string().trim().max(200).default(''),
    afterId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(50),
  })
  .strict()
export type MemoryDocument = z.infer<typeof memoryDocumentSchema>
export type MemoryCommand = z.infer<typeof memoryCommandSchema>

export const memoryRecordSchema = memoryDocumentSchema.extend({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  sourceMessageId: z.string().nullable(),
  sourceRunId: z.string().nullable(),
})
export type MemoryRecord = z.infer<typeof memoryRecordSchema>
