import { z } from 'zod'

export const kodyRunHistoryFilterSchema = z.object({
  triage: z.enum(['open', 'ignored', 'resolved', 'all']).optional(),
  status: z.enum(['running', 'success', 'error']).optional(),
  surface: z
    .enum([
      'execute',
      'export',
      'subscription',
      'app_fetch',
      'app_realtime',
      'job',
      'workflow',
      'retriever',
      'webhook',
    ])
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
})

export const kodyRunHistoryPageSchema = z.object({
  runs: z
    .array(
      z.object({
        id: z.uuid(),
        surface: z.string().max(80),
        status: z.string().max(80),
        name: z.string().max(200).nullable(),
        packageId: z.string().max(300).nullable(),
        jobId: z.string().max(300).nullable(),
        startedAt: z.string().max(100),
        durationMs: z.number().nonnegative().nullable(),
        errorName: z.string().max(200).nullable(),
        errorTriage: z.string().max(80).nullable(),
      }),
    )
    .max(25),
  nextCursor: z.string().min(1).max(2048).nullable(),
})

export type KodyRunHistoryFilter = z.infer<typeof kodyRunHistoryFilterSchema>
export type KodyRunHistoryPage = z.infer<typeof kodyRunHistoryPageSchema>
