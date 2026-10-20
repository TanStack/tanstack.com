import { z } from 'zod'

export const kodyRunSchema = z.object({
  id: z.uuid(),
  status: z.string().max(80),
  surface: z.string().max(80),
  name: z.string().max(200).nullable(),
  packageId: z.string().max(300).nullable(),
  sourceId: z.string().max(300).nullable(),
  publishedCommit: z.string().max(200).nullable(),
  startedAt: z.string().max(100).nullable(),
  finishedAt: z.string().max(100).nullable(),
  durationMs: z.number().nonnegative().nullable(),
  errorName: z.string().max(200).nullable(),
  errorMessage: z.string().max(2000).nullable(),
  errorTriage: z.enum(['open', 'ignored', 'resolved']).optional(),
  logCount: z.number().int().nonnegative(),
  logs: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative(),
        level: z.string().max(30),
        message: z.string().max(1000),
      }),
    )
    .max(50),
})

export type KodyRun = z.infer<typeof kodyRunSchema>
