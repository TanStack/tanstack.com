import { z } from 'zod'
import { messageAttachmentSchema } from './message-attachments'

// Only native callbacks publish these snapshots. They identify outputs or an
// explicitly presented existing file, never grant access or supply URLs.
const deliveryFields = {
  workspaceId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^\s/\\?#%\p{Cc}\p{Cf}]+$/u),
  toolCallId: z.string().min(1).max(256),
}
export const fileDeliverySchema = z.discriminatedUnion('kind', [
  z.object({
    ...deliveryFields,
    // Preserve the original save receipt shape and assistant-only source.
    kind: z.literal('file'),
    file: messageAttachmentSchema.extend({ source: z.literal('assistant') }),
  }),
  z.object({
    ...deliveryFields,
    kind: z.literal('file-copy'),
    file: messageAttachmentSchema.extend({ source: z.literal('assistant') }),
  }),
  z.object({
    ...deliveryFields,
    kind: z.literal('file-reference'),
    file: messageAttachmentSchema,
  }),
])
export type FileDelivery = z.infer<typeof fileDeliverySchema>
export const maxFileDeliveriesPerMessage = 48

export function fileDeliveryToolName(delivery: Pick<FileDelivery, 'kind'>) {
  return delivery.kind === 'file-reference'
    ? 'present_file'
    : delivery.kind === 'file-copy'
      ? 'copy_file'
      : 'save_file'
}

export function fileDeliveryKey(delivery: FileDelivery) {
  return JSON.stringify([
    delivery.workspaceId,
    delivery.file.botId,
    ...(delivery.file.conversationId ? [delivery.file.conversationId] : []),
    delivery.file.id,
  ])
}

/** Forgiving display reader; only the native file paths publish metadata. */
export function readFileDeliveries(message: unknown): FileDelivery[] {
  if (!message || typeof message !== 'object') return []
  const row = message as Record<string, unknown>
  if (row.role !== 'assistant' || !Array.isArray(row.parts)) return []
  const metadata = row.metadata
  if (!metadata || typeof metadata !== 'object') return []
  const values = (metadata as Record<string, unknown>).gumFileDeliveries
  if (!Array.isArray(values) || values.length > maxFileDeliveriesPerMessage)
    return []
  const nativeCalls = new Set(
    row.parts.flatMap((part) =>
      part &&
      typeof part === 'object' &&
      part.type === 'tool-call' &&
      (part.name === 'save_file' ||
        part.name === 'present_file' ||
        part.name === 'copy_file') &&
      typeof part.id === 'string'
        ? [JSON.stringify([part.name, part.id])]
        : [],
    ),
  )
  const seen = new Set<string>()
  const deliveries: FileDelivery[] = []
  for (const value of values) {
    const parsed = fileDeliverySchema.safeParse(value)
    if (
      !parsed.success ||
      !nativeCalls.has(
        JSON.stringify([
          fileDeliveryToolName(parsed.data),
          parsed.data.toolCallId,
        ]),
      )
    )
      continue
    const key = fileDeliveryKey(parsed.data)
    if (seen.has(key)) continue
    seen.add(key)
    deliveries.push(parsed.data)
  }
  return deliveries
}
