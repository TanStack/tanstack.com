import { z } from 'zod'
import { maxSelectedSkills, skillIdentifierSchema } from './skill-identifiers'

export const maxMessageReferences = 10
export const maxSelectedPlugins = 8
const resourceId = z
  .string()
  .min(1)
  .max(200)
  // Unicode property escapes need JavaScript's /u flag, which JSON Schema
  // patterns cannot carry. Keep this check in runtime validation so schemas
  // embedded in model tools remain portable across provider regex engines.
  .refine(
    (value) => /^[^\s/\\?#%\p{Cc}\p{Cf}]+$/u.test(value),
    'Use a valid resource ID.',
  )
  .refine((value) => !/[\uD800-\uDFFF]/u.test(value), 'Use valid Unicode.')
const fileId = z
  .string()
  .uuid()
  .transform((id) => id.toLowerCase())
// Conversation IDs are opaque storage identities, not path segments or bot IDs.
const conversationId = z.string().min(1).max(1000)
const fileReference = z
  .object({
    kind: z.literal('file'),
    botId: resourceId,
    conversationId: conversationId.optional(),
    fileId,
  })
  .strict()
const conversationReference = z
  .object({
    kind: z.literal('conversation'),
    botId: resourceId,
    conversationId: conversationId.optional(),
  })
  .strict()
export {
  fileReference as fileReferenceInputSchema,
  conversationReference as conversationReferenceInputSchema,
}
const connectionReference = z
  .object({ kind: z.literal('connection'), serverId: resourceId })
  .strict()
const skillReference = z
  .object({
    kind: z.literal('skill'),
    skillId: skillIdentifierSchema.transform((id) => id.toLowerCase()),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
const pluginReference = z
  .object({
    kind: z.literal('plugin'),
    installationId: z.string().uuid(),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
// MCP names are opaque identifiers. Never derive them from display labels.
const toolReference = z
  .object({
    kind: z.literal('tool'),
    serverId: resourceId,
    toolName: z
      .string()
      .min(1)
      .max(200)
      .refine(
        (value) => /^[^\p{Cc}\p{Cf}]+$/u.test(value),
        'Use a valid tool name.',
      )
      .refine((value) => !/[\uD800-\uDFFF]/u.test(value), 'Use valid Unicode.'),
  })
  .strict()
const kodyReference = z
  .object({
    kind: z.literal('kody'),
    entity: z
      .string()
      .min(1)
      .max(500)
      .regex(
        /^(capability|package|integration|mcp-server|job|workflow-run|run):\S+$/,
      ),
    operation: z.string().min(1).max(200).optional(),
  })
  .strict()
export const referenceInputSchema = z.discriminatedUnion('kind', [
  fileReference,
  conversationReference,
  connectionReference,
  toolReference,
  kodyReference,
  skillReference,
  pluginReference,
])
export type ReferenceInput = z.infer<typeof referenceInputSchema>
export const referenceKey = (reference: ReferenceInput) =>
  JSON.stringify(
    reference.kind === 'skill'
      ? [reference.kind, reference.skillId, reference.version]
      : reference.kind === 'plugin'
        ? [reference.kind, reference.installationId, reference.version]
        : reference.kind === 'tool'
          ? [reference.kind, reference.serverId, reference.toolName]
          : reference.kind === 'kody'
            ? [reference.kind, reference.entity, reference.operation ?? null]
            : reference.kind === 'connection'
              ? [reference.kind, reference.serverId]
              : reference.kind === 'file'
                ? [
                    reference.kind,
                    reference.botId,
                    reference.fileId,
                    ...(reference.conversationId
                      ? [reference.conversationId]
                      : []),
                  ]
                : [
                    reference.kind,
                    reference.botId,
                    ...(reference.conversationId
                      ? [reference.conversationId]
                      : []),
                  ],
  )
export const referenceInputsSchema = z
  .array(referenceInputSchema)
  .max(maxMessageReferences)
  .refine(
    (items) => new Set(items.map(referenceKey)).size === items.length,
    'Reference each item only once.',
  )
  .refine(
    (items) =>
      items.filter((item) => item.kind === 'skill').length <= maxSelectedSkills,
    'Select up to 3 skills per message.',
  )
  .refine((items) => {
    const skills = items.filter((item) => item.kind === 'skill')
    return new Set(skills.map((item) => item.skillId)).size === skills.length
  }, 'Select only one version of each skill.')
  .refine(
    (items) =>
      items.filter((item) => item.kind === 'plugin').length <=
      maxSelectedPlugins,
    'Select up to 8 plugins per message.',
  )
  .refine((items) => {
    const plugins = items.filter((item) => item.kind === 'plugin')
    return (
      new Set(plugins.map((item) => item.installationId)).size ===
      plugins.length
    )
  }, 'Select only one installed version of each plugin.')

const display = {
  label: z.string().min(1).max(200),
  detail: z.string().max(200).optional(),
}
export const messageReferenceSchema = z.discriminatedUnion('kind', [
  fileReference
    .extend({ ...display, recentAt: z.number().int().nonnegative().optional() })
    .strip(),
  conversationReference.extend(display).strip(),
  connectionReference.extend(display).strip(),
  toolReference.extend(display).strip(),
  kodyReference.extend(display).strip(),
  skillReference.extend(display).strip(),
  pluginReference.extend(display).strip(),
])
export type MessageReference = z.infer<typeof messageReferenceSchema>
export interface ReferenceCatalog {
  items: MessageReference[]
  more: boolean
  kodyStatus?:
    | 'blocked'
    | 'disconnected'
    | 'missing'
    | 'partial'
    | 'ready'
    | 'stale'
  kodyObjectsStatus?: 'blocked' | 'disconnected' | 'missing' | 'ready' | 'stale'
  toolSources?: Array<{
    serverId: string
    label: string
    status: 'missing' | 'ready' | 'stale'
    fetchedAt?: number
  }>
}
export type ReferenceKind = ReferenceInput['kind']
export function referenceInput(reference: MessageReference): ReferenceInput {
  if (reference.kind === 'plugin')
    return {
      kind: reference.kind,
      installationId: reference.installationId,
      version: reference.version,
    }
  if (reference.kind === 'skill')
    return {
      kind: reference.kind,
      skillId: reference.skillId,
      version: reference.version,
    }
  if (reference.kind === 'tool')
    return {
      kind: reference.kind,
      serverId: reference.serverId,
      toolName: reference.toolName,
    }
  if (reference.kind === 'kody')
    return {
      kind: reference.kind,
      entity: reference.entity,
      ...(reference.operation ? { operation: reference.operation } : {}),
    }
  if (reference.kind === 'file')
    return {
      kind: reference.kind,
      botId: reference.botId,
      fileId: reference.fileId,
      ...(reference.conversationId
        ? { conversationId: reference.conversationId }
        : {}),
    }
  if (reference.kind === 'conversation')
    return {
      kind: reference.kind,
      botId: reference.botId,
      ...(reference.conversationId
        ? { conversationId: reference.conversationId }
        : {}),
    }
  return { kind: reference.kind, serverId: reference.serverId }
}

/** Display snapshots cannot grant access or provide model instructions. */
export function readMessageReferences(message: unknown): MessageReference[] {
  const metadata = (
    message as { metadata?: { gumReferences?: unknown } } | null
  )?.metadata
  return readReferenceSnapshots(metadata?.gumReferences)
}

/** Bounded display metadata, with unknown payload fields removed. */
export function readReferenceSnapshots(value: unknown): MessageReference[] {
  if (!Array.isArray(value) || value.length > maxMessageReferences) return []
  const result: MessageReference[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const parsed = messageReferenceSchema.safeParse(item)
    if (parsed.success && !seen.has(referenceKey(parsed.data))) {
      seen.add(referenceKey(parsed.data))
      result.push(parsed.data)
    }
  }
  return result
}

export interface ConversationReferencePage {
  transcriptEpoch: string
  untrusted: true
  window: 'current' | 'archived'
  revision: string
  text: string
  nextOffset?: number
  nextBefore?: number
}

export type ConversationReferenceResult =
  | ConversationReferencePage
  | {
      error: {
        code: 'source_changed' | 'unavailable' | 'invalid_cursor'
        status: number
        message: string
      }
    }
