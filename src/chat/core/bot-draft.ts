import { z } from 'zod'
import { messageAttachmentIdsSchema } from './message-attachments'
import { runModelSchema, type RunModelSelection } from './run-model'
import {
  referenceInputsSchema,
  type ReferenceInput,
} from './message-references'

export const botDraftInput = z
  .object({
    text: z.string().trim().max(12000),
    fileIds: messageAttachmentIdsSchema.default([]),
    runModel: runModelSchema.optional(),
    references: referenceInputsSchema.default([]),
    parentId: z.string().min(1).max(200).nullable().default(null),
  })
  .strict()
  .refine(
    (input) =>
      input.text.length > 0 ||
      input.fileIds.length > 0 ||
      input.references.some((reference) => reference.kind === 'file'),
    'Write a message or attach a file.',
  )

export interface BotDraftReceipt {
  conversationId?: string
  botId: string
  parentId: string | null
  text: string
  started: boolean
  fileIds: string[]
  runModel?: RunModelSelection
  references?: ReferenceInput[]
}

/** A readable provisional label, not an inferred permanent instruction. */
export function draftBotName(text: string) {
  const line = text.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ')
  return !line
    ? 'New conversation'
    : line.length <= 60
      ? line
      : line.slice(0, 57).trimEnd() + '…'
}
