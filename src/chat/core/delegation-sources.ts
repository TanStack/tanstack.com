import { z } from 'zod'
import {
  fileReferenceInputSchema,
  conversationReferenceInputSchema,
  maxMessageReferences,
  referenceInput,
  referenceKey,
  type MessageReference,
} from './message-references'
import {
  maxMessageAttachments,
  type MessageAttachment,
} from './message-attachments'

const sourceId = z.string().regex(/^source-[1-9][0-9]?$/)
export const delegationSourceIdsSchema = z
  .array(sourceId)
  .max(maxMessageReferences)
  .refine((ids) => new Set(ids).size === ids.length, 'Select each source once.')
export const delegationSourceSchema = z.strictObject({
  id: sourceId,
  label: z.string().min(1).max(200),
  reference: z.union([
    fileReferenceInputSchema,
    conversationReferenceInputSchema,
  ]),
})
export const delegationSourcesSchema = z
  .array(delegationSourceSchema)
  .max(maxMessageReferences)
  .refine(
    (sources) =>
      new Set(sources.map((source) => source.id)).size === sources.length,
    'Select each source once.',
  )
  .refine(
    (sources) =>
      new Set(sources.map((source) => referenceKey(source.reference))).size ===
      sources.length,
    'Reference each source once.',
  )
  .refine(
    (sources) =>
      sources.filter((source) => source.reference.kind === 'file').length <=
      maxMessageAttachments,
    'Select up to 5 files.',
  )
export type DelegationSource = z.infer<typeof delegationSourceSchema>

/** Frozen task-local selectors for user-selected data, never a new access grant. */
export function buildDelegationSources(
  references: readonly MessageReference[],
  attachments: readonly MessageAttachment[],
): DelegationSource[] {
  const sources: DelegationSource[] = []
  const seen = new Set<string>()
  const add = (reference: DelegationSource['reference'], label: string) => {
    const key = referenceKey(reference)
    if (seen.has(key)) return
    seen.add(key)
    sources.push({ id: `source-${sources.length + 1}`, reference, label })
  }
  for (const item of references) {
    const reference = referenceInput(item)
    if (reference.kind === 'file' || reference.kind === 'conversation')
      add(reference, item.label)
  }
  for (const file of attachments)
    add(
      {
        kind: 'file',
        botId: file.botId,
        fileId: file.id,
        ...(file.conversationId ? { conversationId: file.conversationId } : {}),
      },
      file.name,
    )
  return sources
}

export function selectDelegationSources(
  available: readonly DelegationSource[],
  raw: unknown,
) {
  const ids = delegationSourceIdsSchema.parse(raw ?? [])
  return delegationSourcesSchema.parse(
    ids.map((id) => {
      const source = available.find((source) => source.id === id)
      if (!source)
        throw new Error('Choose a source available to this parent task.')
      return source
    }),
  )
}
