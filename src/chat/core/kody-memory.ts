import { z } from 'zod'

export const kodyMemoryQuerySchema = z.string().trim().min(1).max(200)
export const kodyMemoryIdSchema = z.string().min(1).max(256)

const summarySchema = z.object({
  id: kodyMemoryIdSchema,
  status: z.enum(['active', 'archived', 'deleted']),
  subject: z.string().max(300),
  summary: z.string().max(2000),
  category: z.string().max(100).nullable(),
  updatedAt: z.string().max(100),
  canMutate: z.boolean().default(false),
})
export type KodyMemoryMatch = z.infer<typeof summarySchema>

export const kodyMemorySearchSchema = z.object({
  items: z.array(summarySchema).max(20),
})

export const kodyMemoryDetailSchema = summarySchema.extend({
  details: z.string().max(20000),
  tags: z.array(z.string().max(100)).max(30),
  createdAt: z.string().max(100),
  sourceUris: z.array(z.string().max(1000)).max(20),
})

export const kodyMemoryChangeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('update'),
    expectedUpdatedAt: z.string().min(1).max(100),
    subject: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(2000),
    details: z.string().max(20000),
  }),
  z.object({
    type: z.literal('delete'),
    expectedUpdatedAt: z.string().min(1).max(100),
  }),
])
export type KodyMemoryChange = z.infer<typeof kodyMemoryChangeSchema>

export const kodyMemoryReviewSchema = z.object({
  token: z.string().min(1).max(100000),
  type: z.enum(['update', 'delete']),
  related: z
    .array(
      z.object({
        id: kodyMemoryIdSchema,
        subject: z.string().max(300),
        summary: z.string().max(2000),
        status: z.enum(['active', 'archived', 'deleted']),
      }),
    )
    .max(5),
})

export const kodyMemoryApplySchema = z.object({
  token: kodyMemoryReviewSchema.shape.token,
  operationId: z.uuid(),
})

export const kodyMemoryCreateSchema = z
  .object({
    subject: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(2000),
    details: z.string().max(20000).default(''),
  })
  .strict()

export const kodyMemoryCreateReviewSchema = z.object({
  token: z.string().min(1).max(100000),
  related: kodyMemoryReviewSchema.shape.related,
  duplicateId: kodyMemoryIdSchema.optional(),
})
