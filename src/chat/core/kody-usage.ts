import { z } from 'zod'

const kodyUsageAmountSchema = z.object({
  current: z.number().nonnegative(),
  limit: z.number().nonnegative(),
  percent: z.number().nonnegative().nullable(),
  overEightyPercent: z.boolean(),
})

export const kodyUsageResourceSchema = kodyUsageAmountSchema.extend({
  resource: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  group: z.enum(['monthly', 'daily', 'counts', 'storage', 'limits']),
  kind: z.enum(['counter', 'per_unit_max']),
  whatCounts: z.string().max(2000),
  week: kodyUsageAmountSchema.optional(),
})
export type KodyUsageResource = z.infer<typeof kodyUsageResourceSchema>

export const kodyUsageSchema = z.object({
  plan: z.enum(['free', 'standard', 'pro', 'max']),
  day: z.iso.date(),
  weekStart: z.iso.date(),
  resources: z.array(kodyUsageResourceSchema).max(100),
})
export type KodyUsage = z.infer<typeof kodyUsageSchema>
