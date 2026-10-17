import { z } from 'zod'
import { messageAttachmentIdsSchema } from './message-attachments'
import { runModelSchema } from './run-model'
import { referenceInputsSchema } from './message-references'

export const referenceSelectionSchema = z
  .array(
    z
      .object({
        key: z.string().min(1).max(7000),
        token: z.string().uuid(),
      })
      .strict(),
  )
  .max(10)
export type ReferenceSelectionSnapshot = z.infer<
  typeof referenceSelectionSchema
>

export const retrySendBindingSchema = z.strictObject({
  attemptId: z.string().uuid(),
  draftRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})
export type RetrySendBinding = z.infer<typeof retrySendBindingSchema>

const scopeSchema = z
  .object({
    userId: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    botId: z.string().min(1).max(200),
    conversationId: z.string().min(1).max(1000).optional(),
  })
  .strict()
const payloadSchema = z
  .object({
    messageId: z.string().uuid(),
    text: z.string().max(12000),
    fileIds: messageAttachmentIdsSchema,
    proposeToolsOnly: z.boolean(),
    refreshCatalog: z.boolean(),
    systemOne: z.boolean(),
    delivery: z.enum(['queue', 'interrupt']),
    runModel: runModelSchema.optional(),
    references: referenceInputsSchema.optional(),
    retry: retrySendBindingSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !!value.text.trim() ||
      !!value.fileIds.length ||
      value.references?.some((item) => item.kind === 'file'),
  )
const envelopeSchema = z
  .object({
    version: z.literal(1),
    scope: scopeSchema,
    payload: payloadSchema,
    rejected: z.boolean(),
    acknowledged: z.boolean().default(false),
    referenceSelection: referenceSelectionSchema.optional(),
  })
  .strict()
// Covers a fully escaped 12k-character message, ten 7000-character cleanup
// keys, ten opaque 1000-character conversation IDs, and bounded metadata.
const maxPendingSendCharacters = 600_000
export type SendScope = z.infer<typeof scopeSchema>
export type SendPayload = z.infer<typeof payloadSchema>
export type SendEnvelope = z.infer<typeof envelopeSchema>
export type NewSend = Omit<SendPayload, 'messageId'> & {
  referenceSelection?: ReferenceSelectionSnapshot
}
export type SendStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type SendResolution =
  | { kind: 'empty' }
  | { kind: 'accepted' | 'rejected'; envelope: SendEnvelope; error?: string }
  | { kind: 'pending'; envelope: SendEnvelope; error?: string }

export class SendStorageError extends Error {
  constructor() {
    super(
      'TanChat cannot save this send safely on this device. Enable browser storage, then check again.',
    )
    this.name = 'SendStorageError'
  }
}
export const sendReceiptKey = (scope: SendScope) =>
  JSON.stringify([
    'gum',
    'pending-send',
    scope.conversationId ? 2 : 1,
    scope.userId,
    scope.workspaceId,
    scope.botId,
    ...(scope.conversationId ? [scope.conversationId] : []),
  ])

/** Legacy envelopes may only run through an explicitly declared main alias. */
export function assertSendDestination(
  scope: SendScope,
  destination: {
    userId: string
    workspaceId: string
    botId: string
    conversationId?: string
    isMainConversation: boolean
  },
) {
  if (
    scope.userId !== destination.userId ||
    scope.workspaceId !== destination.workspaceId ||
    scope.botId !== destination.botId ||
    (scope.conversationId
      ? scope.conversationId !== destination.conversationId
      : !destination.isMainConversation)
  )
    throw new SendStorageError()
}

/** Only metadata and the original request belong here, never uploaded file bytes. */
export class PendingSendStore {
  readonly key: string
  constructor(
    private storage: SendStorage,
    private scope: SendScope,
  ) {
    scopeSchema.parse(scope)
    this.key = sendReceiptKey(scope)
  }
  read(): SendEnvelope | null {
    try {
      const raw = this.storage.getItem(this.key)
      if (raw === null) return null
      if (raw.length > maxPendingSendCharacters)
        throw new Error('Invalid pending send')
      const value = envelopeSchema.parse(JSON.parse(raw))
      if (sendReceiptKey(value.scope) !== this.key)
        throw new Error('Wrong scope')
      return value
    } catch {
      throw new SendStorageError()
    }
  }
  private write(envelope: SendEnvelope) {
    try {
      const serialized = JSON.stringify(envelopeSchema.parse(envelope))
      if (serialized.length > maxPendingSendCharacters)
        throw new Error('Pending send is too large')
      this.storage.setItem(this.key, serialized)
      if (this.storage.getItem(this.key) !== serialized)
        throw new Error('Not saved')
    } catch {
      throw new SendStorageError()
    }
  }
  create(input: NewSend): SendEnvelope {
    if (this.read())
      throw new Error(
        'Confirm the previous send before sending another message.',
      )
    const { referenceSelection, ...payload } = input
    const envelope: SendEnvelope = {
      version: 1,
      scope: { ...this.scope },
      payload: payloadSchema.parse({
        ...payload,
        messageId: crypto.randomUUID(),
      }),
      rejected: false,
      acknowledged: false,
      ...(referenceSelection
        ? {
            referenceSelection:
              referenceSelectionSchema.parse(referenceSelection),
          }
        : {}),
    }
    this.write(envelope)
    return envelope
  }
  markRejected(envelope: SendEnvelope, rejected: boolean): SendEnvelope {
    const current = this.read()
    if (current?.payload.messageId !== envelope.payload.messageId)
      throw new Error('The pending send changed. Check its status again.')
    const next = { ...current, rejected }
    this.write(next)
    return next
  }
  markAcknowledged(envelope: SendEnvelope): SendEnvelope {
    const current = this.read()
    if (current?.payload.messageId !== envelope.payload.messageId)
      throw new Error('The pending send changed. Check its status again.')
    const next = { ...current, acknowledged: true }
    this.write(next)
    return next
  }
  clear(envelope: SendEnvelope) {
    const current = this.read()
    if (!current) return
    if (current.payload.messageId !== envelope.payload.messageId)
      throw new Error('The pending send changed. Check its status again.')
    try {
      this.storage.removeItem(this.key)
      if (this.storage.getItem(this.key) !== null)
        throw new Error('Not removed')
    } catch {
      throw new SendStorageError()
    }
  }
}

type CoordinatorOptions = {
  store: PendingSendStore
  /** Browser Web Locks serializes the entire decision across tabs of this scope. */
  lock: <T>(operation: () => Promise<T>) => Promise<T>
  post: (payload: SendPayload) => Promise<unknown>
  receipt: (messageId: string) => Promise<{ accepted: boolean }>
  definitiveRejection: (error: unknown) => boolean
}

/** Unknown outcomes never permit a new ID. Checking a receipt never starts work. */
export class PendingSendCoordinator {
  constructor(private options: CoordinatorOptions) {}
  private async reconcile(
    envelope: SendEnvelope,
    cause?: unknown,
  ): Promise<SendResolution> {
    if (envelope.acknowledged) return { kind: 'accepted', envelope }
    let accepted: boolean
    try {
      const result = await this.options.receipt(envelope.payload.messageId)
      if (typeof result.accepted !== 'boolean')
        throw new Error('Invalid send receipt')
      accepted = result.accepted
    } catch {
      return {
        kind: 'pending',
        envelope,
        error:
          'The send could not be confirmed. Check again or retry the same message.',
      }
    }
    if (accepted || envelope.rejected) {
      if (accepted) envelope = this.options.store.markAcknowledged(envelope)
      else this.options.store.clear(envelope)
      return {
        kind: accepted ? 'accepted' : 'rejected',
        envelope,
        ...(!accepted
          ? {
              error:
                cause instanceof Error
                  ? cause.message
                  : 'This message was not sent. You can edit and send it again.',
            }
          : {}),
      }
    }
    return {
      kind: 'pending',
      envelope,
      ...(cause
        ? {
            error:
              'The send could not be confirmed. Retry the same message safely.',
          }
        : {}),
    }
  }
  check() {
    return this.options.lock(async (): Promise<SendResolution> => {
      const envelope = this.options.store.read()
      return envelope ? this.reconcile(envelope) : { kind: 'empty' }
    })
  }
  private async post(envelope: SendEnvelope): Promise<SendResolution> {
    let failure: unknown
    try {
      await this.options.post(envelope.payload)
    } catch (error) {
      failure = error
    }
    if (failure === undefined) {
      envelope = this.options.store.markAcknowledged(envelope)
      return { kind: 'accepted', envelope }
    }
    if (this.options.definitiveRejection(failure))
      envelope = this.options.store.markRejected(envelope, true)
    return this.reconcile(envelope, failure)
  }
  submit(input: NewSend) {
    return this.options.lock(async (): Promise<SendResolution> => {
      const existing = this.options.store.read()
      if (existing)
        return {
          kind: 'pending',
          envelope: existing,
          error: 'Confirm the previous send before sending another message.',
        }
      return this.post(this.options.store.create(input))
    })
  }
  retry() {
    return this.options.lock(async (): Promise<SendResolution> => {
      let envelope = this.options.store.read()
      if (!envelope) return { kind: 'empty' }
      // A retry first checks for acceptance. It may post only because the person
      // explicitly requested it, using the original immutable message identity.
      const resolution = await this.reconcile(envelope)
      if (resolution.kind !== 'pending') return resolution
      envelope = this.options.store.markRejected(envelope, false)
      return this.post(envelope)
    })
  }
  /** The caller must first durably clear only the matching composer text/files. */
  finishAccepted(envelope: SendEnvelope) {
    return this.options.lock(async () => {
      const current = this.options.store.read()
      if (current?.payload.messageId === envelope.payload.messageId) {
        if (!current.acknowledged)
          throw new Error('This send is not confirmed.')
        this.options.store.clear(current)
      }
      return this.options.store.read()
    })
  }
}
