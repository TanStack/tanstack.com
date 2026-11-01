import { z } from 'zod'

export const kodyResourceKindSchema = z.enum([
  'subscriptions',
  'webhooks',
  'secrets',
  'secret-providers',
  'shared',
])
export type KodyResourceKind = z.infer<typeof kodyResourceKindSchema>
export const kodyResourcePageSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(1000),
        name: z.string().max(500),
        packageId: z.string().max(300).nullable(),
        fields: z
          .array(
            z.object({
              label: z.string().max(100),
              value: z.string().max(2000),
            }),
          )
          .max(12),
      }),
    )
    .max(200),
  limited: z.boolean(),
})
