import { z } from 'zod'

export const transcriptNavigationRequest = z
  .object({
    before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    epoch: z.string().min(1).max(128).optional(),
  })
  .strict()
  .refine((value) => value.before === undefined || !!value.epoch, {
    message: 'An earlier page requires its conversation version.',
  })

export type ArchivedNavigationItem = {
  id: string
  sequence: number
  prompt: string
  preview: string
}
export type TranscriptNavigationPage = {
  epoch: string
  items: ArchivedNavigationItem[]
  nextBefore: number | null
  /** Zero-based ordinal of the oldest item in this page. */
  startIndex: number
  total: number
}
