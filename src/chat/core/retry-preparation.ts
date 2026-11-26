import { z } from 'zod'
import type { RetryDraftLock, RetryDraftStorage } from './retry-draft'

const identity = z.string().min(1).max(200)
const uuid = z.string().uuid()
const messageIdSchema = z.string().min(1).max(128)
const scopeSchema = z.strictObject({
  userId: identity,
  workspaceId: identity,
  botId: identity,
  conversationId: z.string().min(1).max(1000),
})
export type RetryPreparationScope = z.infer<typeof scopeSchema>
const entrySchema = z.strictObject({
  messageId: messageIdSchema,
  idempotencyKey: uuid,
  attemptId: uuid.optional(),
  handled: z.boolean(),
})
const recordSchema = entrySchema.extend({
  version: z.literal(1),
  scope: scopeSchema,
})
export type RetryPreparationRecord = z.infer<typeof recordSchema>
const documentSchema = z
  .strictObject({
    version: z.literal(1),
    scope: scopeSchema,
    currentMessageId: messageIdSchema,
    records: z.array(entrySchema).min(1).max(256),
  })
  .refine(
    (value) =>
      value.records.some(
        (record) => record.messageId === value.currentMessageId,
      ) &&
      new Set(value.records.map((record) => record.messageId)).size ===
        value.records.length &&
      new Set(value.records.map((record) => record.idempotencyKey)).size ===
        value.records.length,
  )
type RetryPreparationDocument = z.infer<typeof documentSchema>
type RetryPreparationEntry = z.infer<typeof entrySchema>
const maxStoredCharacters = 256 * 1024

export class RetryPreparationStorageError extends Error {
  constructor() {
    super('This retry could not be saved or read safely on this device.')
    this.name = 'RetryPreparationStorageError'
  }
}

export class RetryPreparationConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryPreparationConflictError'
  }
}

export const retryPreparationKey = (scope: RetryPreparationScope) =>
  JSON.stringify([
    'gum',
    'retry-preparation',
    1,
    scope.userId,
    scope.workspaceId,
    scope.botId,
    scope.conversationId,
  ])

/** Keep a create request's identity before contacting the server. Every writer
 * must use the same cross-tab lock and durable local storage. No request text,
 * evidence, network requests or session storage belong in this record.
 */
export class RetryPreparationStore {
  readonly key: string
  private readonly scope: RetryPreparationScope

  constructor(
    private readonly options: {
      storage: RetryDraftStorage
      scope: RetryPreparationScope
      lock: RetryDraftLock
    },
  ) {
    this.scope = scopeSchema.parse(options.scope)
    this.key = retryPreparationKey(this.scope)
  }

  read(): RetryPreparationRecord | null {
    const document = this.readDocument()
    return document ? this.selected(document) : null
  }

  private selected(document: RetryPreparationDocument): RetryPreparationRecord {
    return {
      version: 1,
      scope: document.scope,
      ...this.selectedEntry(document),
    }
  }

  private selectedEntry(
    document: RetryPreparationDocument,
  ): RetryPreparationEntry {
    return document.records.find(
      (record) => record.messageId === document.currentMessageId,
    )!
  }

  private readDocument(): RetryPreparationDocument | null {
    try {
      const raw = this.options.storage.getItem(this.key)
      if (raw === null) return null
      if (raw.length > maxStoredCharacters) throw new Error('Oversized record')
      const parsed: unknown = JSON.parse(raw)
      // Preserve identities saved by the earlier single-message format.
      const legacy = recordSchema.safeParse(parsed)
      const document = documentSchema.parse(
        legacy.success
          ? {
              version: 1,
              scope: legacy.data.scope,
              currentMessageId: legacy.data.messageId,
              records: [
                entrySchema.parse({
                  messageId: legacy.data.messageId,
                  idempotencyKey: legacy.data.idempotencyKey,
                  ...(legacy.data.attemptId
                    ? { attemptId: legacy.data.attemptId }
                    : {}),
                  handled: legacy.data.handled,
                }),
              ],
            }
          : parsed,
      )
      if (retryPreparationKey(document.scope) !== this.key)
        throw new Error('Different retry owner')
      return document
    } catch {
      // An unreadable record may hold an accepted request's only identity.
      throw new RetryPreparationStorageError()
    }
  }

  private write(document: RetryPreparationDocument): RetryPreparationRecord {
    try {
      const value = documentSchema.parse(document)
      const serialized = JSON.stringify(value)
      if (serialized.length > maxStoredCharacters)
        throw new Error('Oversized record')
      this.options.storage.setItem(this.key, serialized)
      if (this.options.storage.getItem(this.key) !== serialized)
        throw new Error('Unconfirmed write')
      return this.selected(value)
    } catch {
      throw new RetryPreparationStorageError()
    }
  }

  private create(messageId: string): RetryPreparationEntry {
    return {
      messageId,
      idempotencyKey: crypto.randomUUID(),
      handled: false,
    }
  }

  private expectCurrent(expectedKey: string): RetryPreparationDocument {
    const document = this.readDocument()
    const current = document && this.selected(document)
    if (!current || current.idempotencyKey !== expectedKey)
      throw new RetryPreparationConflictError(
        'This retry changed in another view. Open the saved retry again.',
      )
    return document!
  }

  private replaceCurrent(
    document: RetryPreparationDocument,
    record: RetryPreparationEntry,
  ) {
    return this.write({
      ...document,
      currentMessageId: record.messageId,
      records: document.records.map((previous) =>
        previous.messageId === document.currentMessageId ? record : previous,
      ),
    })
  }

  start(messageId: string): Promise<RetryPreparationRecord> {
    messageIdSchema.parse(messageId)
    return this.options.lock(this.key, () => {
      const document = this.readDocument()
      if (document?.currentMessageId === messageId)
        return this.selected(document)
      const existing = document?.records.find(
        (record) => record.messageId === messageId,
      )
      if (!existing && document && document.records.length >= 256)
        throw new RetryPreparationConflictError(
          'This conversation has reached its saved retry limit.',
        )
      return this.write({
        version: 1,
        scope: this.scope,
        currentMessageId: messageId,
        records: existing
          ? document!.records
          : [...(document?.records ?? []), this.create(messageId)],
      })
    })
  }

  rememberAttempt(
    expectedKey: string,
    attemptId: string,
  ): Promise<RetryPreparationRecord> {
    uuid.parse(expectedKey)
    uuid.parse(attemptId)
    return this.options.lock(this.key, () => {
      const document = this.expectCurrent(expectedKey)
      const current = this.selected(document)
      if (current.attemptId) {
        if (current.attemptId !== attemptId)
          throw new RetryPreparationConflictError(
            'This retry already belongs to a different attempt.',
          )
        return current
      }
      return this.replaceCurrent(document, {
        ...this.selectedEntry(document),
        attemptId,
      })
    })
  }

  markHandled(expectedKey: string): Promise<RetryPreparationRecord> {
    uuid.parse(expectedKey)
    return this.options.lock(this.key, () => {
      const document = this.expectCurrent(expectedKey)
      const current = this.selected(document)
      if (current.handled) return current
      return this.replaceCurrent(document, {
        ...this.selectedEntry(document),
        handled: true,
      })
    })
  }

  /** Call only after the server confirms this attempt failed or was consumed.
   * A lost response or network error must use start() to recover the same key.
   */
  restart(
    expectedKey: string,
    messageId: string,
  ): Promise<RetryPreparationRecord> {
    uuid.parse(expectedKey)
    messageIdSchema.parse(messageId)
    return this.options.lock(this.key, () => {
      const document = this.expectCurrent(expectedKey)
      const current = this.selected(document)
      if (current.messageId !== messageId)
        throw new RetryPreparationConflictError(
          'Open this request before starting another attempt.',
        )
      if (!current.attemptId)
        throw new RetryPreparationConflictError(
          'Recover the saved retry attempt before starting another one.',
        )
      return this.replaceCurrent(document, this.create(messageId))
    })
  }
}
