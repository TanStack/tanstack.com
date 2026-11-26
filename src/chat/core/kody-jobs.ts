import { z } from 'zod'

export const kodyJobChangeSchema = z
  .object({
    enabled: z.boolean(),
    expected: z
      .object({
        enabled: z.boolean(),
        sourceId: z.string().min(1).max(200),
        publishedCommit: z.string().max(200).nullable(),
        updatedAt: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict()

export type KodyJobChange = z.infer<typeof kodyJobChangeSchema>

export const kodyJobChangeResultSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  changed: z.boolean(),
  updatedAt: z.string(),
})
