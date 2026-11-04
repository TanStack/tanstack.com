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
import { sameConversationResource } from './conversation-destination'
import type { RetryRequest } from './retry-request'

export interface RetryFileImport {
  source: MessageAttachment
  targetFileId: string
}

export interface RetryFilePlan {
  version: 1
  references: MessageReference[]
  imports: RetryFileImport[]
}

export class RetryFilePlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryFilePlanError'
  }
}

const referencesSchema = z
  .array(messageReferenceSchema)
  .max(maxMessageReferences)
const targetIdSchema = z
  .string()
  .uuid()
  .transform((id) => id.toLowerCase())

/** Create once and persist before importing. Recovery reuses the saved IDs.
 * This plan neither authorizes a source nor promises its bytes are available.
 * The importer must resolve legacy owners and revalidate access and hashes.
 */
export function createRetryFilePlan(
  request: RetryRequest,
  createId: () => string = () => crypto.randomUUID(),
): RetryFilePlan {
  const attachments = messageAttachmentsSchema.safeParse(request.attachments)
  const references = referencesSchema.safeParse(request.references)
  if (
    !attachments.success ||
    !references.success ||
    !referenceInputsSchema.safeParse(references.data.map(referenceInput))
      .success
  )
    throw new RetryFilePlanError(
      'The original file selections could not be verified. Review the request again.',
    )

  const referencedIds = new Set<string>()
  for (const reference of references.data) {
    if (reference.kind !== 'file') continue
    const snapshot = attachments.data.find(
      (file) => file.id === reference.fileId,
    )
    if (!snapshot)
      throw new RetryFilePlanError(
        'A referenced file is missing its original snapshot. Review the request again.',
      )
    // A missing conversation ID on only one side is not evidence of a match.
    // Keep matching legacy identities intact for the server to resolve later.
    if (!sameConversationResource(snapshot, reference))
      throw new RetryFilePlanError(
        'A referenced file does not match its original conversation. Review the request again.',
      )
    referencedIds.add(snapshot.id)
  }

  const direct = attachments.data.filter((file) => !referencedIds.has(file.id))
  const allocated = new Set(attachments.data.map((file) => file.id))
  const imports = direct.map((source): RetryFileImport => {
    const parsed = targetIdSchema.safeParse(createId())
    if (!parsed.success || allocated.has(parsed.data))
      throw new RetryFilePlanError(
        'New file identities could not be allocated safely. No file plan was created.',
      )
    allocated.add(parsed.data)
    return { source, targetFileId: parsed.data }
  })

  return { version: 1, references: references.data, imports }
}
