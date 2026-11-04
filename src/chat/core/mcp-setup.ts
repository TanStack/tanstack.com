import { z } from 'zod'

export const pluginConnectionTargetSchema = z
  .object({
    installationId: z.string().uuid(),
    version: z.number().int().positive(),
    revision: z.number().int().positive(),
    requirementKey: z.string().min(1).max(200),
  })
  .strict()
export type PluginConnectionTarget = z.infer<
  typeof pluginConnectionTargetSchema
>

export const prepareMcpSetupSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    label: z.string().trim().min(1).max(80).optional(),
    url: z.string().trim().min(1).max(500).optional(),
    plugin: pluginConnectionTargetSchema.optional(),
    returnBotId: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      !!value.plugin || !!value.accountId || (!!value.label && !!value.url),
    'Choose a package requirement, saved connection, or service address.',
  )

export const mcpSetupSummarySchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    label: z.string(),
    url: z.string(),
    status: z.enum(['review', 'starting', 'authorize', 'complete', 'failed']),
    kind: z.enum(['public', 'oauth', 'unsupported']),
    issuer: z.string().optional(),
    scopes: z.array(z.string()),
    registration: z.enum(['metadata', 'dynamic']).optional(),
    expiresAt: z.number(),
    checkedAt: z.number().optional(),
    error: z.string().optional(),
    authorizationUrl: z.string().optional(),
    plugin: pluginConnectionTargetSchema
      .extend({ name: z.string() })
      .optional(),
  })
  .strict()
export type McpSetupSummary = z.infer<typeof mcpSetupSummarySchema>

export const startMcpSetupSchema = z.object({ id: z.string().uuid() }).strict()
