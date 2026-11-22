import { z } from 'zod'
export const mcpCheckErrors = {
  setup: 'The connection service is unavailable in this environment.',
  credentials:
    'The service did not accept this sign-in. Reconnect and try again.',
  network: 'The service could not be reached. Try again later.',
  protocol: 'The service did not complete the MCP connection check.',
} as const
const id = z.string().uuid(),
  revision = z.number().int().nonnegative().safe()
export const mcpAccountSummarySchema = z
  .object({
    id,
    label: z.string(),
    url: z.string(),
    enabled: z.boolean(),
    hasToken: z.boolean(),
    revision,
    authMode: z.enum(['none', 'token', 'oauth']),
    status: z.enum([
      'configured',
      'checked',
      'needs_auth',
      'error',
      'disabled',
    ]),
    checkedAt: z.number().optional(),
    error: z.string().optional(),
  })
  .strict()
export type McpAccountSummary = z.infer<typeof mcpAccountSummarySchema>
const mutation = { id, commandId: id, expectedRevision: revision }
export const mcpAccountCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...mutation,
      type: z.literal('save'),
      label: z.string().trim().min(1).max(80),
      url: z.string().trim().min(1).max(500),
      authMode: z.enum(['none', 'token']),
      token: z.string().min(1).max(16000).optional(),
    })
    .strict(),
  z
    .object({ ...mutation, type: z.literal('enabled'), enabled: z.boolean() })
    .strict(),
  z.object({ ...mutation, type: z.literal('disconnect') }).strict(),
  z.object({ ...mutation, type: z.literal('remove') }).strict(),
])
export type McpAccountCommand = z.infer<typeof mcpAccountCommandSchema>
