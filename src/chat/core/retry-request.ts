import type { UIMessage } from '@tanstack/ai'
import { z } from 'zod'
import {
  messageAttachmentsSchema,
  type MessageAttachment,
} from './message-attachments'
import {
  maxMessageReferences,
  messageReferenceSchema,
  referenceInput,
  referenceInputsSchema,
  type MessageReference,
} from './message-references'
import { runModelSchema, type RunModelSelection } from './run-model'

export interface RetryRequest {
  text: string
  attachments: MessageAttachment[]
  references: MessageReference[]
  runModel?: RunModelSelection
}

export class RetryRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryRequestError'
  }
}

const textPartsSchema = z.array(
  z.object({ type: z.literal('text'), content: z.string() }),
)
const referencesSchema = z
  .array(messageReferenceSchema)
  .max(maxMessageReferences)

/** Strict input projection, not file access, execution authority or a send payload. */
export function parseRetryRequest(message: UIMessage): RetryRequest {
  if (!message || message.role !== 'user')
    throw new RetryRequestError('Choose a user request to edit or try again.')
  const parts = textPartsSchema.safeParse(message.parts)
  if (!parts.success)
    throw new RetryRequestError(
      'This request contains input that cannot be restored yet.',
    )
  const text = parts.data.map((part) => part.content).join('\n')
  if (text.length > 12000)
    throw new RetryRequestError('This request is too long to restore.')
  const metadata = message.metadata
  if (
    metadata !== undefined &&
    (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
  )
    throw new RetryRequestError('The saved request inputs could not be read.')
  const attachments = messageAttachmentsSchema.safeParse(
    metadata && 'gumAttachments' in metadata ? metadata.gumAttachments : [],
  )
  if (!attachments.success)
    throw new RetryRequestError(
      'The saved attachments could not be restored. No inputs were removed.',
    )
  const references = referencesSchema.safeParse(
    metadata && 'gumReferences' in metadata ? metadata.gumReferences : [],
  )
  if (
    !references.success ||
    !referenceInputsSchema.safeParse(references.data.map(referenceInput))
      .success
  )
    throw new RetryRequestError(
      'The saved references could not be restored. No inputs were removed.',
    )
  let runModel: RunModelSelection | undefined
  if (metadata && 'gumRunModel' in metadata) {
    const parsed = runModelSchema.safeParse(metadata.gumRunModel)
    if (!parsed.success)
      throw new RetryRequestError(
        'The saved model choice could not be restored. Choose a model before trying again.',
      )
    runModel = parsed.data
  }
  if (
    !text.trim() &&
    !attachments.data.length &&
    !references.data.some((reference) => reference.kind === 'file')
  )
    throw new RetryRequestError('This request has no text or files to restore.')
  return {
    text,
    attachments: attachments.data,
    references: references.data,
    ...(runModel ? { runModel } : {}),
  }
}
