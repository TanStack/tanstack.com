import { z } from 'zod'
import { maxFileBytes, type SavedFile } from './files'

export const maxMessageAttachments = 5
export type MessageAttachment = SavedFile & { state: 'ready' }

const fileIdSchema = z
  .string()
  .uuid()
  .transform((id) => id.toLowerCase())
export const messageAttachmentIdsSchema = z
  .array(fileIdSchema)
  .max(maxMessageAttachments)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Attach each file only once.',
  )
  .default([])

export function parseAttachmentFileIds(value: unknown): string[] {
  return messageAttachmentIdsSchema.parse(value)
}

// These fields are display/identity snapshots, never authority to fetch a file.
// Object schemas strip unknown fields, including URLs, keys and inline payloads.
export const messageAttachmentSchema = z.object({
  id: fileIdSchema,
  conversationId: z.string().min(1).max(1000).optional(),
  botId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^\s/\\?#%\p{Cc}\p{Cf}]+$/u),
  name: z
    .string()
    .min(1)
    .max(180)
    .refine(
      (name) =>
        !!name.trim() &&
        name !== '.' &&
        name !== '..' &&
        !/[/\\\p{Cc}\p{Cf}]/u.test(name),
    ),
  mediaType: z
    .string()
    .max(200)
    .regex(
      /^[a-z0-9][a-z0-9!#$&^_.+\-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+\-]{0,126}$/,
    ),
  size: z.number().int().min(0).max(maxFileBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.enum(['upload', 'assistant']),
  state: z.literal('ready'),
  createdAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export const messageAttachmentsSchema = z
  .array(messageAttachmentSchema)
  .max(maxMessageAttachments)
  .refine(
    (files) => new Set(files.map((file) => file.id)).size === files.length,
    'Attach each file only once.',
  )

/** Forgiving history reader for rendering. Model projection should use the strict schema. */
export function readMessageAttachments(message: unknown): MessageAttachment[] {
  if (!message || typeof message !== 'object' || !('metadata' in message))
    return []
  const metadata = message.metadata
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('gumAttachments' in metadata)
  )
    return []
  const value = metadata.gumAttachments
  if (!Array.isArray(value) || value.length > maxMessageAttachments) return []
  const files: MessageAttachment[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const parsed = messageAttachmentSchema.safeParse(entry)
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id)
      files.push(parsed.data)
    }
  }
  return files
}

export function messageAttachmentMetadata(
  attachments: readonly MessageAttachment[],
): { gumAttachments: MessageAttachment[] } | undefined {
  const files = messageAttachmentsSchema.parse([...attachments])
  return files.length ? { gumAttachments: files } : undefined
}
