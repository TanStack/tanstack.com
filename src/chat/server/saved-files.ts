import type { R2Object, R2ObjectBody } from '@cloudflare/workers-types'
import { and, eq, isNull, desc, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatSavedFiles,
  chatSavedFileImports,
  chatBots,
  chatConversations,
  chatMemberships,
  chatConversationThreads,
} from '~/db/schema'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import {
  isTextFile,
  maxConversationFileBytes,
  maxConversationFiles,
  maxFileBytes,
  type FileScope,
  type SavedFile,
  type DraftFile,
  type SaveFileInput,
} from '../core/files'
import {
  SavedFileError,
  validateId,
  normalizeInput,
  decodeText,
  validateContent,
  hex,
  file,
  type FileRow,
} from './saved-file-contract'
export { SavedFileError } from './saved-file-contract'
export type { FileRow } from './saved-file-contract'
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export interface FileEnvironment {
  FILES: {
    put: (
      key: string,
      payload: Uint8Array,
      options: {
        onlyIf: { etagDoesNotMatch: string }
        sha256: string
        httpMetadata: { contentType: string }
      },
    ) => Promise<Pick<R2Object, 'size' | 'checksums'> | null>
    head: (key: string) => Promise<Pick<R2Object, 'size' | 'checksums'> | null>
    get: (key: string) => Promise<
      | (Pick<R2ObjectBody, 'size' | 'checksums' | 'arrayBuffer'> & {
          body: ReadableStream<Uint8Array>
        })
      | null
    >
  }
}
export interface FileStoreConfig<T extends SavedFile | DraftFile> {
  where: () => SQL
  maxFiles: number
  maxBytes: number
  limitMessage: string
  authorize: (write: boolean, tx?: Transaction) => Promise<void>
  values: () => {
    workspaceId: string
    userId: string
    botId?: string
    conversationId?: string
    draftId?: string
  }
  record: (row: FileRow) => T
}
const projection = {
  id: chatSavedFiles.id,
  conversation_id: chatSavedFiles.conversationId,
  bot_id: chatSavedFiles.botId,
  draft_id: chatSavedFiles.draftId,
  name: chatSavedFiles.name,
  media_type: chatSavedFiles.mediaType,
  size: chatSavedFiles.size,
  sha256: chatSavedFiles.sha256,
  source: chatSavedFiles.source,
  state: chatSavedFiles.state,
  created_at: chatSavedFiles.createdAt,
}
export class FileStore<T extends SavedFile | DraftFile> {
  constructor(
    private env: FileEnvironment,
    private config: FileStoreConfig<T>,
  ) {}
  protected async authorize(write = false, tx?: Transaction) {
    await this.config.authorize(write, tx)
  }
  private async row(id: string, tx?: Transaction) {
    const [row] = await (tx ?? db)
      .select(projection)
      .from(chatSavedFiles)
      .where(and(this.config.where(), eq(chatSavedFiles.id, id)))
    return row
  }
  async list(): Promise<T[]> {
    await this.authorize()
    const rows = await db
      .select(projection)
      .from(chatSavedFiles)
      .where(this.config.where())
      .orderBy(desc(chatSavedFiles.createdAt), chatSavedFiles.id)
      .limit(this.config.maxFiles)
    await this.authorize()
    return rows.map(this.config.record)
  }
  async get(id: string): Promise<T> {
    validateId(id)
    await this.authorize()
    const row = await this.row(id.toLowerCase())
    await this.authorize()
    if (!row) throw new SavedFileError('File not found.', 404)
    return this.config.record(row)
  }
  async save(input: SaveFileInput, bytes: Uint8Array): Promise<T> {
    return this.saveGuarded(input, bytes)
  }
  protected async saveGuarded(
    input: SaveFileInput,
    bytes: Uint8Array,
    importGuard?: (tx: Transaction) => Promise<void>,
  ): Promise<T> {
    const value = normalizeInput(input)
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxFileBytes)
      throw new SavedFileError('Files can be at most 2 MiB.', 413)
    const payload = new Uint8Array(bytes)
    validateContent(value.mediaType, payload)
    await this.authorize(true)
    const digest = hex(await crypto.subtle.digest('SHA-256', payload))
    const guard = async (tx: Transaction) => {
      if (importGuard) return importGuard(tx)
      const [receipt] = await tx
        .select({ id: chatSavedFileImports.targetFileId })
        .from(chatSavedFileImports)
        .where(eq(chatSavedFileImports.targetFileId, value.id))
      if (receipt)
        throw new SavedFileError(
          'This file write is no longer available. Retry its original operation.',
          409,
        )
    }
    const row = await db.transaction(async (tx) => {
      await this.authorize(true, tx)
      await guard(tx)
      const existing = await this.row(value.id, tx)
      if (existing) return existing
      const [quota] = await tx
        .select({
          count: sql<number>`count(*)::integer`,
          bytes: sql<number>`coalesce(sum(${chatSavedFiles.size}),0)::bigint`,
        })
        .from(chatSavedFiles)
        .where(this.config.where())
      if (
        quota.count >= this.config.maxFiles ||
        Number(quota.bytes) + payload.byteLength > this.config.maxBytes
      )
        throw new SavedFileError(this.config.limitMessage, 409)
      await tx
        .insert(chatSavedFiles)
        .values({
          ...this.config.values(),
          id: value.id,
          name: value.name,
          mediaType: value.mediaType,
          size: payload.byteLength,
          sha256: digest,
          source: value.source,
          state: 'pending',
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
      const saved = await this.row(value.id, tx)
      if (!saved) throw new SavedFileError(this.config.limitMessage, 409)
      return saved
    })
    await this.authorize(true)
    if (
      row.name !== value.name ||
      row.media_type !== value.mediaType ||
      row.source !== value.source ||
      row.size !== payload.byteLength ||
      row.sha256 !== digest
    )
      throw new SavedFileError(
        'This file ID already has different contents or metadata. Retry the original file or use a new ID.',
        409,
      )
    if (row.state === 'ready') return this.config.record(row)
    const key = `saved-files/${row.id}`
    try {
      const object =
        (await this.env.FILES.put(key, payload, {
          onlyIf: { etagDoesNotMatch: '*' },
          sha256: digest,
          httpMetadata: { contentType: value.mediaType },
        })) ?? (await this.env.FILES.head(key))
      if (
        !object ||
        object.size !== row.size ||
        !object.checksums.sha256 ||
        hex(object.checksums.sha256) !== row.sha256
      )
        throw new Error('Stored payload does not match its receipt.')
    } catch {
      throw new SavedFileError(
        'The upload could not finish. Retry the same file to resume.',
        503,
      )
    }
    try {
      await db.transaction(async (tx) => {
        await this.authorize(true, tx)
        await guard(tx)
        await tx
          .update(chatSavedFiles)
          .set({ state: 'ready' })
          .where(and(this.config.where(), eq(chatSavedFiles.id, row.id)))
      })
    } catch (error) {
      if (error instanceof SavedFileError) throw error
      throw new SavedFileError(
        'The upload could not be confirmed. Retry the same file to resume.',
        503,
      )
    }
    await this.authorize(true)
    const ready = await this.row(row.id)
    if (!ready || ready.state !== 'ready')
      throw new SavedFileError(
        'The upload could not be confirmed. Retry the same file to resume.',
        503,
      )
    return this.config.record(ready)
  }
  async content(id: string) {
    const saved = await this.get(id)
    if (saved.state !== 'ready')
      throw new SavedFileError(
        'This upload is unfinished. Retry the original file to complete it.',
        409,
      )
    const object = await this.env.FILES.get(`saved-files/${saved.id}`).catch(
      () => {
        throw new SavedFileError(
          'The stored file could not be loaded. Try again.',
          503,
        )
      },
    )
    if (!object)
      throw new SavedFileError('The stored file is unavailable.', 503)
    try {
      await this.authorize()
      if (
        object.size !== saved.size ||
        !object.checksums.sha256 ||
        hex(object.checksums.sha256) !== saved.sha256
      )
        throw new SavedFileError('The stored file could not be verified.', 503)
    } catch (error) {
      await object.body.cancel().catch(() => {})
      throw error
    }
    return {
      file: saved,
      body: object.body,
      arrayBuffer: () => object.arrayBuffer(),
    }
  }

  async readText(
    id: string,
    options: { offset?: number; limit?: number } = {},
  ): Promise<{
    file: T
    text: string
    offset: number
    nextOffset?: number
    totalChars: number
  }> {
    const offset = options.offset ?? 0
    const limit = options.limit ?? 16000
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > maxFileBytes ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 16000
    )
      throw new SavedFileError(
        'Use a nonnegative character offset and a limit from 1 to 16000.',
        400,
      )
    const saved = await this.get(id)
    if (!isTextFile(saved.mediaType))
      throw new SavedFileError('This file is not readable as text.', 415)
    const result = await this.content(id)
    const bytes = new Uint8Array(await result.arrayBuffer())
    await this.authorize()
    const decoded = decodeText(bytes)
    let totalChars = 0
    let text = ''
    for (const char of decoded) {
      if (totalChars >= offset && totalChars < offset + limit) text += char
      totalChars++
    }
    if (offset > totalChars)
      throw new SavedFileError(
        'The character offset is past the end of this file.',
        400,
      )
    return {
      file: result.file,
      text,
      offset,
      totalChars,
      ...(offset + limit < totalChars ? { nextOffset: offset + limit } : {}),
    }
  }
}

async function readVerifiedFile(
  files: SavedFiles,
  sourceFileId: string,
  signal?: AbortSignal,
) {
  const { file: source, body } = await files.content(sourceFileId)
  const reader = body.getReader()
  const abortRead = () => {
    void reader.cancel(signal?.reason).catch(() => {})
  }
  signal?.addEventListener('abort', abortRead, { once: true })
  let payload: Uint8Array<ArrayBuffer>
  try {
    signal?.throwIfAborted()
    if (source.size > maxFileBytes)
      throw new SavedFileError('Files can be at most 2 MiB.', 413)
    payload = new Uint8Array(source.size)
    let offset = 0
    while (true) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) break
      if (value.byteLength > payload.byteLength - offset)
        throw new SavedFileError('The stored file could not be verified.', 503)
      payload.set(value, offset)
      offset += value.byteLength
    }
    if (
      offset !== source.size ||
      hex(await crypto.subtle.digest('SHA-256', payload)) !== source.sha256
    )
      throw new SavedFileError('The stored file could not be verified.', 503)
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    throw error
  } finally {
    signal?.removeEventListener('abort', abortRead)
    reader.releaseLock()
  }
  return { source, payload }
}

export class SavedFiles extends FileStore<SavedFile> {
  private environment: FileEnvironment
  private scope: FileScope
  constructor(env: FileEnvironment, scope: FileScope) {
    let conversationId = scope.conversationId
    const values = () => {
      if (!conversationId)
        throw new SavedFileError('Conversation access is unavailable.', 403)
      return {
        workspaceId: scope.workspaceId,
        userId: scope.userId,
        botId: scope.botId,
        conversationId,
      }
    }
    super(env, {
      values,
      where: () => {
        const v = values()
        return sql`${chatSavedFiles.workspaceId}=${v.workspaceId} AND ${chatSavedFiles.userId}=${v.userId} AND ${chatSavedFiles.conversationId}=${v.conversationId}`
      },
      maxFiles: maxConversationFiles,
      maxBytes: maxConversationFileBytes,
      limitMessage:
        'This file ID is unavailable or the conversation file limit has been reached (100 files, 50 MiB).',
      record: file,
      authorize: async (write, tx) => {
        if (tx) {
          const [member] = await tx
            .select({ userId: chatMemberships.userId })
            .from(chatMemberships)
            .where(
              and(
                eq(chatMemberships.workspaceId, scope.workspaceId),
                eq(chatMemberships.userId, scope.userId),
              ),
            )
            .for('update')
          if (!member)
            throw new SavedFileError('Conversation access is unavailable.', 403)
        }

        if (!conversationId) {
          try {
            conversationId = (await resolveConversationIdentity(scope))
              .conversationId
          } catch (error) {
            if (error instanceof ConversationIdentityError)
              throw new SavedFileError(
                'Conversation access is unavailable.',
                403,
              )
            throw error
          }
        }
        const query = (tx ?? db)
          .select({ archivedAt: chatBots.archivedAt })
          .from(chatConversations)
          .innerJoin(chatBots, eq(chatBots.id, chatConversations.botId))
          .innerJoin(
            chatMemberships,
            and(
              eq(chatMemberships.workspaceId, chatBots.workspaceId),
              eq(chatMemberships.userId, scope.userId),
            ),
          )
          .where(
            and(
              eq(chatConversations.id, conversationId),
              eq(chatConversations.botId, scope.botId),
              eq(chatConversations.userId, scope.userId),
              eq(chatBots.workspaceId, scope.workspaceId),
              isNull(chatBots.deletedAt),
            ),
          )
        const [row] = await (tx
          ? query.for('update', {
              of: [chatConversations, chatBots, chatMemberships],
            })
          : query)
        if (!row)
          throw new SavedFileError('Conversation access is unavailable.', 403)
        const threadQuery = (tx ?? db)
          .select({ archivedAt: chatConversationThreads.archivedAt })
          .from(chatConversationThreads)
          .where(eq(chatConversationThreads.conversationId, conversationId))
        const [thread] = await (tx ? threadQuery.for('update') : threadQuery)
        if (
          write &&
          (row.archivedAt !== null || (thread && thread.archivedAt !== null))
        )
          throw new SavedFileError(
            'Restore this conversation before saving files.',
            409,
          )
      },
    })
    this.environment = env
    this.scope = { ...scope }
  }
  /** A durable, authorized copy into this owner with a new immutable file ID. */
  async importFrom(
    sourceConversationId: string,
    sourceFileId: string,
    targetFileId: string,
    expectedSha256: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<SavedFile> {
    validateId(sourceFileId)
    validateId(targetFileId)
    sourceFileId = sourceFileId.toLowerCase()
    targetFileId = targetFileId.toLowerCase()
    if (
      sourceFileId === targetFileId ||
      typeof sourceConversationId !== 'string' ||
      !sourceConversationId ||
      sourceConversationId.length > 1000 ||
      !/^[a-f0-9]{64}$/.test(expectedSha256)
    )
      throw new SavedFileError(
        'Use an exact source and a new file ID for the import.',
        400,
      )
    options.signal?.throwIfAborted()
    await this.authorize(true)
    const target = await resolveConversationIdentity(this.scope)
    const receiptWhere = and(
      eq(chatSavedFileImports.targetFileId, targetFileId),
      eq(chatSavedFileImports.workspaceId, target.workspaceId),
      eq(chatSavedFileImports.userId, target.userId),
      eq(chatSavedFileImports.targetConversationId, target.conversationId),
    )
    const readReceipt = async (tx?: Transaction) => {
      const [row] = await (tx ?? db)
        .select()
        .from(chatSavedFileImports)
        .where(receiptWhere)
      return row
    }
    type Receipt = typeof chatSavedFileImports.$inferSelect
    const assertReceipt = (record: Receipt) => {
      if (
        record.sourceConversationId !== sourceConversationId ||
        record.sourceFileId !== sourceFileId ||
        record.sha256 !== expectedSha256
      )
        throw new SavedFileError(
          'This file ID belongs to a different import. Retry the original import.',
          409,
        )
    }
    const matches = (saved: SavedFile, record: Receipt) =>
      saved.state === 'ready' &&
      saved.name === record.name &&
      saved.mediaType === record.mediaType &&
      saved.size === record.size &&
      saved.sha256 === record.sha256 &&
      saved.source === record.source
    let receipt = await readReceipt()
    if (receipt) {
      assertReceipt(receipt)
      let saved: SavedFile | undefined
      try {
        saved = await this.get(targetFileId)
      } catch (error) {
        if (!(error instanceof SavedFileError && error.status === 404))
          throw error
      }
      if (saved?.state === 'ready') {
        if (!matches(saved, receipt))
          throw new SavedFileError(
            'The imported file could not be verified.',
            409,
          )
        await this.authorize(true)
        return saved
      }
    }
    const sourceIdentity = await resolveConversationIdentity({
      workspaceId: target.workspaceId,
      userId: target.userId,
      conversationId: sourceConversationId,
    })
    const sourceFiles = new SavedFiles(this.environment, sourceIdentity)
    const sourceMetadata = await sourceFiles.get(sourceFileId)
    if (
      sourceMetadata.state !== 'ready' ||
      sourceMetadata.sha256 !== expectedSha256
    )
      throw new SavedFileError(
        'The original file changed or is unavailable. Review the request again.',
        409,
      )
    if (!receipt) {
      await db.transaction(async (tx) => {
        await this.authorize(true, tx)
        await sourceFiles.authorize(false, tx)
        const existing = await readReceipt(tx)
        if (existing) {
          assertReceipt(existing)
          return
        }
        const [occupied] = await tx
          .select({ id: chatSavedFiles.id })
          .from(chatSavedFiles)
          .where(eq(chatSavedFiles.id, targetFileId))
        const [quota] = await tx
          .select({ count: sql<number>`count(*)::integer` })
          .from(chatSavedFileImports)
          .where(
            and(
              eq(chatSavedFileImports.workspaceId, target.workspaceId),
              eq(chatSavedFileImports.userId, target.userId),
              eq(
                chatSavedFileImports.targetConversationId,
                target.conversationId,
              ),
            ),
          )
        if (occupied || quota.count >= maxConversationFiles)
          throw new SavedFileError(
            'The file import could not be started. Check access and retry an existing import, or use an unused ID within the 100-import limit.',
            409,
          )
        const [source] = await tx
          .select(projection)
          .from(chatSavedFiles)
          .where(
            and(
              eq(chatSavedFiles.id, sourceFileId),
              eq(chatSavedFiles.workspaceId, target.workspaceId),
              eq(chatSavedFiles.userId, target.userId),
              eq(chatSavedFiles.conversationId, sourceConversationId),
            ),
          )
        if (
          !source ||
          source.state !== 'ready' ||
          source.sha256 !== expectedSha256
        )
          throw new SavedFileError(
            'The original file changed or is unavailable. Review the request again.',
            409,
          )
        await tx
          .insert(chatSavedFileImports)
          .values({
            targetFileId,
            workspaceId: target.workspaceId,
            userId: target.userId,
            targetConversationId: target.conversationId,
            sourceConversationId,
            sourceFileId,
            sha256: source.sha256,
            name: source.name,
            mediaType: source.media_type,
            size: source.size,
            source: source.source,
            createdAt: Date.now(),
          })
          .onConflictDoNothing()
      })
      receipt = await readReceipt()
      if (!receipt)
        throw new SavedFileError(
          'The file import could not be started. Check access and retry an existing import, or use an unused ID within the 100-import limit.',
          409,
        )
      assertReceipt(receipt)
    }
    if (!matches(sourceMetadata, receipt))
      throw new SavedFileError(
        'The original file changed. Review the request again.',
        409,
      )
    const { source, payload } = await readVerifiedFile(
      sourceFiles,
      sourceFileId,
      options.signal,
    )
    if (!matches(source, receipt))
      throw new SavedFileError(
        'The original file changed. Review the request again.',
        409,
      )
    options.signal?.throwIfAborted()
    return this.saveGuarded(
      {
        id: targetFileId,
        name: receipt.name,
        mediaType: receipt.mediaType,
        source: receipt.source,
      },
      payload,
      async (tx) => {
        const current = await readReceipt(tx)
        if (!current)
          throw new SavedFileError(
            'This file write is no longer available. Retry its original operation.',
            409,
          )
        assertReceipt(current)
        await sourceFiles.authorize(false, tx)
        const [row] = await tx
          .select(projection)
          .from(chatSavedFiles)
          .where(
            and(
              eq(chatSavedFiles.id, sourceFileId),
              eq(chatSavedFiles.workspaceId, target.workspaceId),
              eq(chatSavedFiles.userId, target.userId),
              eq(chatSavedFiles.conversationId, sourceConversationId),
            ),
          )
        if (!row || !matches(file(row), current))
          throw new SavedFileError(
            'This file write is no longer available. Retry its original operation.',
            409,
          )
      },
    )
  }

  /** Copy one currently authorized immutable source without decoding its bytes. */
  async copy(
    sourceFileId: string,
    destination: Pick<SaveFileInput, 'id' | 'name'>,
    options: {
      beforeSave?: (source: SavedFile) => Promise<void>
      signal?: AbortSignal
    } = {},
  ): Promise<SavedFile> {
    validateId(sourceFileId)
    validateId(destination.id)
    if (sourceFileId.toLowerCase() === destination.id.toLowerCase())
      throw new SavedFileError('Choose a new file ID for the copy.', 400)
    options.signal?.throwIfAborted()
    const { source, payload } = await readVerifiedFile(
      this,
      sourceFileId,
      options.signal,
    )
    const input = normalizeInput({
      ...destination,
      mediaType: source.mediaType,
      source: 'assistant',
    })
    // Reading the body and persisting a delivery intent may both yield. Recheck
    // the exact source before the existing save path authorizes the new write.
    const verifySource = async () => {
      const current = await this.get(source.id)
      if (
        current.state !== 'ready' ||
        current.sha256 !== source.sha256 ||
        current.size !== source.size ||
        current.mediaType !== source.mediaType
      )
        throw new SavedFileError('The source file changed. Try again.', 409)
    }
    await verifySource()
    options.signal?.throwIfAborted()
    if (options.beforeSave) {
      await options.beforeSave(source)
      await verifySource()
    }
    options.signal?.throwIfAborted()
    return this.save(input, payload)
  }
}
