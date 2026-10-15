import { z } from 'zod'

export const kodyServerAddSchema = z
  .object({
    operationId: z.uuid(),
    name: z
      .string()
      .min(1)
      .max(64)
      .regex(
        /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/,
        'Use lowercase letters, numbers, and dashes.',
      ),
    url: z
      .url()
      .max(500)
      .refine((value) => {
        const url = new URL(value)
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.hash
        )
      }, 'Use an HTTPS server address without credentials or a fragment.'),
  })
  .strict()
export type KodyServerAdd = z.infer<typeof kodyServerAddSchema>

export const kodyServerAddResultSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  state: z.string(),
  connected: z.boolean(),
  toolCount: z.number().int().nonnegative(),
  authUrl: z.url().optional(),
  error: z.string().optional(),
  existing: z.boolean(),
})

export const kodyServerReconnectSchema = z.object({
  expected: z.object({
    name: z.string(),
    updatedAt: z.string(),
    enabled: z.literal(true),
    connected: z.literal(false),
  }),
})
export type KodyServerReconnect = z.infer<typeof kodyServerReconnectSchema>

export const kodyServerCheckSchema = z.object({
  expected: z.object({
    name: z.string(),
    updatedAt: z.string(),
    enabled: z.literal(true),
    connected: z.literal(true),
  }),
})
export type KodyServerCheck = z.infer<typeof kodyServerCheckSchema>

export const kodyServerReconnectResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  connected: z.boolean(),
  authUrl: z.url().optional(),
  error: z.string().optional(),
  changed: z.boolean(),
})

export const kodyServerEnabledSchema = z.object({
  operationId: z.uuid(),
  enabled: z.boolean(),
  expected: z.object({
    name: z.string(),
    updatedAt: z.string(),
    enabled: z.boolean(),
  }),
})
export type KodyServerEnabled = z.infer<typeof kodyServerEnabledSchema>

export const kodyServerEnabledResultSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  enabled: z.boolean(),
  changed: z.boolean(),
})
