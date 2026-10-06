import { z } from 'zod'
import {
  parsedPluginPackageSchema,
  pluginCompatibilitySchema,
  pluginFileTableSchema,
} from './plugins'

const uuid = z.string().uuid()
const version = z.number().int().positive().safe()
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const command = { id: uuid, commandId: uuid }
const edit = { ...command, expectedRevision: version }

export const pluginCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...command,
      type: z.literal('install'),
      files: pluginFileTableSchema,
      digest,
      enabled: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      ...edit,
      type: z.literal('update'),
      files: pluginFileTableSchema,
      digest,
    })
    .strict(),
  z
    .object({ ...edit, type: z.literal('enabled'), enabled: z.boolean() })
    .strict(),
  z.object({ ...edit, type: z.literal('remove') }).strict(),
  z.object({ ...edit, type: z.literal('restore') }).strict(),
  z
    .object({
      ...edit,
      type: z.literal('bind'),
      version,
      requirementKey: z.string().min(1).max(256),
      serverId: uuid.nullable(),
    })
    .strict(),
])
export type PluginCommand = z.infer<typeof pluginCommandSchema>

export const pluginSummarySchema = z
  .object({
    id: uuid,
    name: z.string(),
    description: z.string(),
    packageVersion: z.string().optional(),
    currentVersion: version,
    revision: version,
    enabled: z.boolean(),
    removed: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    digest,
    compatibility: pluginCompatibilitySchema,
  })
  .strict()
export type PluginSummary = z.infer<typeof pluginSummarySchema>

export const pluginBindingSchema = z
  .object({
    version,
    requirementKey: z.string(),
    serverId: uuid,
    endpoint: z.string(),
  })
  .strict()
export type PluginBinding = z.infer<typeof pluginBindingSchema>

export const pluginVersionSchema = pluginSummarySchema.extend({
  version,
  package: parsedPluginPackageSchema,
  bindings: z.array(pluginBindingSchema),
})
export type PluginVersion = z.infer<typeof pluginVersionSchema>

export const pluginListSchema = z
  .object({
    items: z.array(pluginSummarySchema),
    nextCursor: z.string().optional(),
  })
  .strict()
