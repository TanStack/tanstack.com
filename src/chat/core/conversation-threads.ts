import { z } from 'zod'
import type { BotActivitySummary } from './bot-activity'
import { readFileDeliveries } from './file-deliveries'
import { readMessageAttachments } from './message-attachments'
import {
  fileReferenceInputSchema,
  readMessageReferences,
  referenceInput,
  referenceKey,
  type ReferenceInput,
} from './message-references'

const maxInheritedFiles = 5
export function threadSourceFiles(message: unknown) {
  const row = message as Parameters<typeof readMessageReferences>[0]
  const candidates = [
    ...readFileDeliveries(row).map(({ file }) => ({
      kind: 'file' as const,
      botId: file.botId,
      fileId: file.id,
      ...(file.conversationId ? { conversationId: file.conversationId } : {}),
    })),
    ...readMessageAttachments(row).map((file) => ({
      kind: 'file' as const,
      botId: file.botId,
      fileId: file.id,
      ...(file.conversationId ? { conversationId: file.conversationId } : {}),
    })),
    ...readMessageReferences(row)
      .map(referenceInput)
      .filter((item) => item.kind === 'file'),
  ]
  const unique = [
    ...new Map(candidates.map((item) => [referenceKey(item), item])).values(),
  ]
  return {
    files: unique.slice(0, maxInheritedFiles),
    filesLimited: unique.length > maxInheritedFiles,
  }
}

export function inheritThreadFiles(
  selected: readonly ReferenceInput[],
  files: readonly z.infer<typeof fileReferenceInputSchema>[],
) {
  const result = [...selected]
  const seen = new Set(result.map(referenceKey))
  const passed = [] as Array<z.infer<typeof fileReferenceInputSchema>>
  let fileCount = result.filter((item) => item.kind === 'file').length
  let limited = false
  for (const file of files) {
    const key = referenceKey(file)
    if (seen.has(key)) {
      passed.push(file)
      continue
    }
    if (result.length >= 10 || fileCount >= maxInheritedFiles) {
      limited = true
      continue
    }
    seen.add(key)
    result.push(file)
    passed.push(file)
    fileCount++
  }
  return { references: result, passed, limited }
}

export function threadContextSnapshot(
  messages: readonly {
    id: string
    role: string
    parts: readonly { type: string; content?: unknown }[]
  }[],
  sourceId: string,
) {
  const boundary = messages.findIndex((message) => message.id === sourceId)
  const prior =
    boundary < 0
      ? []
      : messages
          .slice(0, boundary)
          .filter(
            (message) =>
              message.role === 'user' || message.role === 'assistant',
          )
  let remaining = 12000
  const excerpts: {
    messageId: string
    role: 'user' | 'assistant'
    text: string
    truncated: boolean
  }[] = []
  for (const message of prior.slice().reverse()) {
    if (excerpts.length >= 12 || remaining === 0) break
    const original = message.parts
      .filter(
        (part) => part.type === 'text' && typeof part.content === 'string',
      )
      .map((part) => part.content)
      .join('\n')
      .trim()
    if (!original) continue
    let text = original.slice(0, Math.min(3000, remaining))
    if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
    remaining -= text.length
    excerpts.unshift({
      messageId: message.id,
      role: message.role as 'user' | 'assistant',
      text,
      truncated: text.length < original.length,
    })
  }
  return {
    version: 1 as const,
    kind: 'excerpts' as const,
    throughMessageId: sourceId,
    messages: excerpts,
    limited: true as const,
  }
}

export const threadSourceSchema = z
  .object({
    context: z
      .object({
        version: z.literal(1),
        kind: z.literal('excerpts'),
        throughMessageId: z.string(),
        messages: z
          .array(
            z.object({
              messageId: z.string(),
              role: z.enum(['user', 'assistant']),
              text: z.string().max(3000),
              truncated: z.boolean(),
            }),
          )
          .max(12),
        limited: z.literal(true),
      })
      .optional(),
    epoch: z.string().min(1).max(1000),
    digest: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    role: z.enum(['user', 'assistant']),
    text: z.string().min(1).max(12000),
    truncated: z.boolean(),
    files: z.array(fileReferenceInputSchema).max(maxInheritedFiles).optional(),
    filesLimited: z.boolean().optional(),
  })
  .strict()
export type ThreadSource = z.infer<typeof threadSourceSchema>

export interface ThreadSummary {
  conversationId: string
  botId: string
  parentConversationId: string
  sourceMessageId: string
  title: string
  version: number
  archivedAt: number | null
  createdAt: number
  source: ThreadSource
  activity?: BotActivitySummary
}
export type ThreadListItem = Omit<ThreadSummary, 'source'>

export const createThreadSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    sourceMessageId: z.string().min(1).max(128),
  })
  .strict()

export const maxConversationThreads = 100

export const renameThreadSchema = z.strictObject({
  type: z.literal('rename'),
  title: z.string().trim().min(1).max(80),
  expectedVersion: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
})

export const archiveThreadSchema = z.strictObject({
  type: z.literal('archive'),
  archived: z.boolean(),
  expectedVersion: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
})

export const threadCommandSchema = z.discriminatedUnion('type', [
  renameThreadSchema,
  archiveThreadSchema,
])
