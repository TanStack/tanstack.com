import { z } from 'zod'
import { canonicalCopyJson } from './conversation-copy'
import { messageAttachmentsSchema } from './message-attachments'
import {
  maxMessageReferences,
  messageReferenceSchema,
  referenceInput,
  referenceInputsSchema,
} from './message-references'
import { runModelSchema } from './run-model'
import { maxFileBytes } from './files'

const identity = z.string().min(1).max(200)
const uuid = z.string().uuid()
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const targetSchema = z
  .object({ botId: identity, conversationId: z.string().min(1).max(1000) })
  .strict()
const scopeSchema = targetSchema.extend({
  userId: identity,
  workspaceId: identity,
})
export type RetryDraftScope = z.infer<typeof scopeSchema>
export const retryPendingAttachmentSchema = z
  .object({
    id: uuid,
    name: z
      .string()
      .min(1)
      .max(180)
      .refine((name) => !!name.trim() && !/[/\\\p{Cc}\p{Cf}]/u.test(name)),
    size: z.number().int().min(0).max(maxFileBytes),
    mediaType: z.string().min(1).max(200),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    generated: z.literal(true).optional(),
  })
  .strict()
export type RetryPendingAttachment = z.infer<
  typeof retryPendingAttachmentSchema
>

export const retryDraftContentSchema = z
  .object({
    text: z.string().max(12000),
    attachments: messageAttachmentsSchema,
    pendingAttachments: z.array(retryPendingAttachmentSchema).max(5).optional(),
    references: z.array(messageReferenceSchema).max(maxMessageReferences),
    runModel: runModelSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      referenceInputsSchema.safeParse(value.references.map(referenceInput))
        .success,
    'Use valid, distinct references.',
  )
  .refine(
    (value) =>
      value.attachments.length +
        (value.pendingAttachments?.length ?? 0) +
        value.references.filter((reference) => reference.kind === 'file')
          .length <=
      5,
    'Attach up to 5 files per message.',
  )
  .refine((value) => {
    const ids = [...value.attachments, ...(value.pendingAttachments ?? [])].map(
      (file) => file.id.toLowerCase(),
    )
    return new Set(ids).size === ids.length
  }, 'Attach each file only once.')
export type RetryDraftContent = z.infer<typeof retryDraftContentSchema>
const hasTargetFiles = (
  content: RetryDraftContent,
  target: z.infer<typeof targetSchema>,
) =>
  content.attachments.every(
    (file) =>
      file.botId === target.botId &&
      file.conversationId === target.conversationId,
  )
const seedSchema = z
  .object({
    attemptId: uuid,
    target: targetSchema,
    request: retryDraftContentSchema.refine(
      (value) =>
        !!value.text.trim() ||
        !!value.attachments.length ||
        value.references.some((reference) => reference.kind === 'file'),
      'The original request has no text or files.',
    ),
    evidenceDigest: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict()
  .refine(
    (value) => hasTargetFiles(value.request, value.target),
    'The imported attachments must belong to the retry conversation.',
  )
  .refine(
    (value) => !value.request.pendingAttachments?.length,
    'A server retry seed cannot contain unfinished uploads.',
  )
export type RetryDraftSeed = z.infer<typeof seedSchema>
const consumptionSchema = z
  .object({ draftRevision: revision, messageId: uuid })
  .strict()
export type RetryDraftConsumption = z.infer<typeof consumptionSchema>
const documentSchema = z
  .object({
    version: z.literal(1),
    scope: scopeSchema,
    seed: seedSchema,
    revision,
    draft: retryDraftContentSchema,
    consumed: consumptionSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.seed.target.botId === value.scope.botId &&
      value.seed.target.conversationId === value.scope.conversationId &&
      hasTargetFiles(value.draft, value.scope) &&
      (!value.consumed || value.consumed.draftRevision <= value.revision),
  )
export type RetryDraftDocument = z.infer<typeof documentSchema>
export type RetryDraftStorage = Pick<Storage, 'getItem' | 'setItem'>
export type RetryDraftLock = <T>(
  key: string,
  operation: () => T | Promise<T>,
) => Promise<T>
const maxStoredCharacters = 1024 * 1024

export class RetryDraftStorageError extends Error {
  constructor() {
    super('This retry draft could not be saved or read safely on this device.')
    this.name = 'RetryDraftStorageError'
  }
}
export class RetryDraftConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryDraftConflictError'
  }
}
export const retryDraftKey = (scope: RetryDraftScope, attemptId: string) =>
  JSON.stringify([
    'gum',
    'retry-draft',
    1,
    scope.userId,
    scope.workspaceId,
    scope.botId,
    scope.conversationId,
    attemptId,
  ])

/** One atomic document for a retry editor. It never writes the normal draft's
 * keys or submits a request. Every writer must use the same cross-tab lock.
 */
export class RetryDraftStore {
  readonly key: string
  private readonly scope: RetryDraftScope
  private readonly attemptId: string

  constructor(
    private readonly options: {
      storage: RetryDraftStorage
      scope: RetryDraftScope
      attemptId: string
      lock: RetryDraftLock
    },
  ) {
    this.scope = scopeSchema.parse(options.scope)
    this.attemptId = uuid.parse(options.attemptId)
    this.key = retryDraftKey(this.scope, this.attemptId)
  }

  read(): RetryDraftDocument | null {
    try {
      const raw = this.options.storage.getItem(this.key)
      if (raw === null) return null
      if (raw.length > maxStoredCharacters) throw new Error('Oversized draft')
      const value = documentSchema.parse(JSON.parse(raw))
      if (retryDraftKey(value.scope, value.seed.attemptId) !== this.key)
        throw new Error('Different draft owner')
      return value
    } catch {
      // Corrupt or inaccessible storage must never look like an empty draft.
      throw new RetryDraftStorageError()
    }
  }

  private write(document: RetryDraftDocument) {
    try {
      const value = documentSchema.parse(document)
      const serialized = JSON.stringify(value)
      if (serialized.length > maxStoredCharacters)
        throw new Error('Oversized draft')
      this.options.storage.setItem(this.key, serialized)
      if (this.options.storage.getItem(this.key) !== serialized)
        throw new Error('Unconfirmed write')
      return value
    } catch {
      throw new RetryDraftStorageError()
    }
  }

  adoptRetrySeed(seed: RetryDraftSeed): Promise<RetryDraftDocument> {
    // Detach the server view before waiting on another tab's write.
    const frozen = seedSchema.parse(seed)
    if (
      frozen.attemptId !== this.attemptId ||
      frozen.target.botId !== this.scope.botId ||
      frozen.target.conversationId !== this.scope.conversationId
    )
      throw new RetryDraftConflictError(
        'This retry belongs to another conversation or attempt.',
      )
    return this.options.lock(this.key, () => {
      const current = this.read()
      if (current) {
        if (canonicalCopyJson(current.seed) !== canonicalCopyJson(frozen))
          throw new RetryDraftConflictError(
            'The original retry inputs changed. Keep the saved draft and review the source again.',
          )
        // A blank edited draft and a consumed draft are both existing drafts.
        return current
      }
      return this.write({
        version: 1,
        scope: this.scope,
        seed: frozen,
        revision: 0,
        draft: frozen.request,
      })
    })
  }

  update(
    expectedRevision: number,
    draft: RetryDraftContent,
  ): Promise<RetryDraftDocument> {
    revision.parse(expectedRevision)
    const frozen = retryDraftContentSchema.parse(draft)
    if (!hasTargetFiles(frozen, this.scope))
      throw new RetryDraftConflictError(
        'The attachments belong to another conversation.',
      )
    return this.options.lock(this.key, () => {
      const current = this.read()
      if (!current)
        throw new RetryDraftConflictError('Open this retry before editing it.')
      if (current.consumed)
        throw new RetryDraftConflictError(
          'This retry was already sent. Its saved edits have been kept.',
        )
      if (current.revision !== expectedRevision)
        throw new RetryDraftConflictError(
          'This retry changed in another view. Keep your edits and review the saved draft.',
        )
      if (current.revision === Number.MAX_SAFE_INTEGER)
        throw new RetryDraftConflictError(
          'This draft cannot accept more revisions.',
        )
      return this.write({
        ...current,
        revision: current.revision + 1,
        draft: frozen,
      })
    })
  }

  /** Call only after an accepted send receipt. Keep later edits and a permanent
   * marker so reload or a delayed server seed cannot repopulate a sent request.
   */
  consume(accepted: RetryDraftConsumption): Promise<RetryDraftDocument> {
    const frozen = consumptionSchema.parse(accepted)
    return this.options.lock(this.key, () => {
      const current = this.read()
      if (!current)
        throw new RetryDraftConflictError('The retry draft is unavailable.')
      if (current.consumed) {
        if (canonicalCopyJson(current.consumed) !== canonicalCopyJson(frozen))
          throw new RetryDraftConflictError(
            'This retry already has a different accepted send.',
          )
        return current
      }
      if (frozen.draftRevision > current.revision)
        throw new RetryDraftConflictError(
          'The accepted send refers to an unavailable draft revision.',
        )
      return this.write({ ...current, consumed: frozen })
    })
  }
}
