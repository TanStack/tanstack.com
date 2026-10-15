import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { parseInline, type InlineNode } from '@tanstack/markdown'
import {
  createThreadSchema,
  archiveThreadSchema,
  renameThreadSchema,
  maxConversationThreads,
  threadSourceSchema,
  type ThreadSummary,
  type ThreadListItem,
  type ThreadSource,
} from '../core/conversation-threads'
import {
  resolveConversationIdentity,
  ConversationIdentityError,
} from '../conversation-identity.server'
import { canonicalCopyJson } from '../core/conversation-copy'
import { hash } from './crypto'

type ConversationIdentity = Awaited<
  ReturnType<typeof resolveConversationIdentity>
>
export interface ThreadEnvironment {
  CONVERSATIONS: {
    getByName(id: string): {
      bindIdentity(identity: ConversationIdentity): Promise<unknown>
      captureThreadSource(
        identity: ConversationIdentity,
        messageId: string,
      ): Promise<
        | { ok: true; source: unknown }
        | { ok: false; error: string; status: number }
      >
      reserveEmptyThread(id: string): Promise<{ reserved: boolean }>
      reserveDeletion(id: string): Promise<{
        reserved: boolean
        draining?: boolean
        executionSession?: boolean
      }>
      releaseDeletion(id: string): Promise<unknown>
    }
  }
}
const createDelegatedThreadSchema = createThreadSchema
  .extend({
    conversationId: z.string().uuid(),
    source: threadSourceSchema.extend({ role: z.literal('user') }),
    title: z.string().min(1).max(80),
  })
  .strict()
type ThreadCreationRequest =
  | ({ kind: 'manual' } & z.infer<typeof createThreadSchema>)
  | ({ kind: 'delegated' } & z.infer<typeof createDelegatedThreadSchema>)

export class ConversationThreadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'ConversationThreadError'
  }
}
type ThreadRow = {
  conversation_id: string
  bot_id: string
  parent_conversation_id: string
  source_message_id: string
  source_context: string
  title: string
  version: number
  archived_at: number | null
  created_at: number
  status: NonNullable<ThreadSummary['activity']>['status'] | null
  activity_at: number | null
  event_version: number | null
  read_version: number | null
  preview: string | null
  message_count: number | null
  queued_count: number | null
  queue_paused: number | null
}
const columns =
  sql.raw(`t.conversation_id,t.parent_conversation_id,t.source_message_id,t.title,t.version,
 (extract(epoch from t.archived_at)*1000)::double precision AS archived_at,c.bot_id,
 (extract(epoch from c.created_at)*1000)::double precision AS created_at,a.status,
 a.activity_at::double precision AS activity_at,a.event_version::double precision AS event_version,
 a.read_version::double precision AS read_version,a.preview,a.message_count::double precision AS message_count,
 a.queued_count::double precision AS queued_count,a.queue_paused`)
const from =
  sql.raw(`FROM chat_conversation_threads t JOIN chat_conversations c ON c.id=t.conversation_id
 JOIN chat_bots b ON b.id=c.bot_id
 JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id
 LEFT JOIN chat_conversation_activity a ON a.conversation_id=c.id AND a.bot_id=c.bot_id AND a.user_id=c.user_id`)
const inlineText = (node: InlineNode): string => {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if (node.type === 'image') return node.alt
  if ('children' in node) return node.children.map(inlineText).join('')
  return node.type === 'break' ? ' ' : ''
}
const sourceTitle = (text: string) =>
  [...parseInline(text).map(inlineText).join('').replace(/\s+/g, ' ').trim()]
    .slice(0, 80)
    .join('') || 'Thread'
const listItem = (
  row: Omit<ThreadRow, 'source_context'>,
  userId: string,
): ThreadListItem => ({
  conversationId: row.conversation_id,
  botId: row.bot_id,
  parentConversationId: row.parent_conversation_id,
  sourceMessageId: row.source_message_id,
  title: row.title,
  version: row.version,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  ...(row.status
    ? {
        activity: {
          conversationId: row.conversation_id,
          botId: row.bot_id,
          userId,
          status: row.status,
          activityAt: row.activity_at!,
          eventVersion: row.event_version!,
          readVersion: row.read_version!,
          preview: row.preview!,
          messageCount: row.message_count!,
          queuedCount: row.queued_count!,
          queuePaused: !!row.queue_paused,
        },
      }
    : {}),
})

/** Stored source text is evidence, never an executable transcript or an access grant. */
export async function conversationThreadContext(
  identity: ConversationIdentity,
) {
  const [row] = await db.execute<{
    parent_conversation_id: string | null
    source_message_id: string | null
    source_context: string | null
  }>(sql`SELECT t.parent_conversation_id,t.source_message_id,t.source::text AS source_context
    FROM chat_conversations c
    JOIN chat_bots b ON b.id=c.bot_id
    JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id
    LEFT JOIN chat_conversation_threads t ON t.conversation_id=c.id
    WHERE c.id=${identity.conversationId} AND c.bot_id=${identity.botId}
      AND c.user_id=${identity.userId}::uuid AND b.workspace_id=${identity.workspaceId}
      AND b.deleted_at IS NULL`)
  if (!row) throw new ConversationIdentityError()
  return row.parent_conversation_id &&
    row.source_message_id &&
    row.source_context
    ? {
        parentConversationId: row.parent_conversation_id,
        sourceMessageId: row.source_message_id,
        source: threadSourceSchema.parse(JSON.parse(row.source_context)),
      }
    : undefined
}

export class ConversationThreads {
  constructor(
    readonly env: ThreadEnvironment,
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
  private identity(conversationId: string) {
    return resolveConversationIdentity({
      conversationId,
      workspaceId: this.workspaceId,
      userId: this.userId,
    })
  }
  async get(conversationId: string): Promise<ThreadSummary> {
    await this.identity(conversationId)
    const [row] = await db.execute<ThreadRow>(
      sql`SELECT ${columns},t.source::text AS source_context ${from} WHERE c.id=${conversationId} AND c.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL`,
    )
    if (!row) throw new ConversationThreadError('Thread not found.', 404)
    return {
      ...listItem(row, this.userId),
      source: threadSourceSchema.parse(JSON.parse(row.source_context)),
    }
  }
  async archive(
    conversationId: string,
    raw: unknown,
    onlyIfEmpty = false,
  ): Promise<ThreadSummary> {
    const command = archiveThreadSchema.parse(raw)
    const thread = await this.get(conversationId)
    if (thread.version !== command.expectedVersion) {
      if (
        thread.version === command.expectedVersion + 1 &&
        (thread.archivedAt !== null) === command.archived
      )
        return thread
      throw new ConversationThreadError(
        'This thread changed. Refresh before trying again.',
        409,
      )
    }
    const identity = await this.identity(conversationId)
    const stub = this.env.CONVERSATIONS.getByName(conversationId)
    const reservationId = crypto.randomUUID()
    const expiresAt = Date.now() + 50_000
    let reserved = false
    try {
      if (command.archived) {
        await stub.bindIdentity(identity)
        if (onlyIfEmpty) {
          const empty = await stub.reserveEmptyThread(reservationId)
          if (!empty.reserved) return thread
          reserved = true
        }
        let result = onlyIfEmpty
          ? { reserved: true }
          : await stub.reserveDeletion(reservationId)
        for (
          let attempt = 0;
          !result.reserved &&
          'draining' in result &&
          result.draining &&
          attempt < 40;
          attempt++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          result = await stub.reserveDeletion(reservationId)
        }
        if (!result.reserved)
          throw new ConversationThreadError(
            'executionSession' in result && result.executionSession
              ? 'Close the active execution session before archiving this thread.'
              : 'This thread is still stopping work. Try archiving it again shortly.',
            409,
          )
        reserved = true
      }
      const [changed] =
        await db.execute(sql`UPDATE chat_conversation_threads SET archived_at=${command.archived ? new Date().toISOString() : null}::timestamptz,version=version+1
        WHERE conversation_id=${conversationId} AND version=${command.expectedVersion}
        AND (${!onlyIfEmpty} OR NOT EXISTS(SELECT 1 FROM chat_conversation_threads child WHERE child.parent_conversation_id=chat_conversation_threads.conversation_id))
        AND extract(epoch from clock_timestamp())*1000<${expiresAt}
        AND conversation_id IN (SELECT c.id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${conversationId} AND c.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL AND b.archived_at IS NULL) RETURNING version`)
      const current = await this.get(conversationId)
      if (!changed)
        throw new ConversationThreadError(
          'This thread changed or its lifecycle check expired. Refresh before trying again.',
          409,
        )
      return current
    } finally {
      if (reserved) await stub.releaseDeletion(reservationId).catch(() => {})
    }
  }
  async rename(
    conversationId: string,
    raw: unknown,
    beforeWrite: () => void = () => {},
  ): Promise<ThreadSummary> {
    const command = renameThreadSchema.parse(raw)
    await this.get(conversationId)
    beforeWrite()
    // Scope and membership are checked again by the write, after the async read.
    const [changed] =
      await db.execute(sql`UPDATE chat_conversation_threads SET title=${command.title},version=version+1 WHERE conversation_id=${conversationId} AND version=${command.expectedVersion}
      AND conversation_id IN (SELECT c.id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${conversationId} AND c.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL AND b.archived_at IS NULL) RETURNING version`)
    const current = await this.get(conversationId)
    if (
      changed ||
      (current.version === command.expectedVersion + 1 &&
        current.title === command.title)
    )
      return current
    throw new ConversationThreadError(
      'This thread changed. Review its current name before trying again.',
      409,
    )
  }
  async list(
    parentConversationId: string,
  ): Promise<{ items: ThreadListItem[] }> {
    await this.identity(parentConversationId)
    const rows =
      await db.execute<ThreadRow>(sql`SELECT ${columns} ${from} WHERE t.parent_conversation_id=${parentConversationId} AND c.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL
      AND (t.archived_at IS NULL OR COALESCE(a.message_count,0)>0 OR EXISTS(SELECT 1 FROM chat_conversation_threads child WHERE child.parent_conversation_id=c.id)) ORDER BY c.created_at,c.id LIMIT ${maxConversationThreads}`)
    return { items: rows.map((row) => listItem(row, this.userId)) }
  }
  async create(
    parentConversationId: string,
    input: unknown,
  ): Promise<ThreadSummary> {
    return this.createAuthorized(parentConversationId, {
      ...createThreadSchema.parse(input),
      kind: 'manual',
    })
  }
  /** Internal admission only. The parent supplies the user source captured when
   * its task was admitted, so a retry never depends on the current transcript.
   */
  async createDelegated(
    parentConversationId: string,
    input: unknown,
  ): Promise<ThreadSummary> {
    return this.createAuthorized(parentConversationId, {
      ...createDelegatedThreadSchema.parse(input),
      kind: 'delegated',
    })
  }
  private async createAuthorized(
    parentConversationId: string,
    value: ThreadCreationRequest,
  ): Promise<ThreadSummary> {
    const parent = await this.identity(parentConversationId)
    const { idempotencyKey, ...request } = value
    const requestDigest = await hash(
      canonicalCopyJson({ parentConversationId, ...request }),
    )
    // Existing manual receipts predate the namespace. Only manual requests may
    // replay them; delegated requests always bind the supplied child and source.
    const legacyDigest =
      value.kind === 'manual'
        ? await hash(
            canonicalCopyJson({
              parentConversationId,
              sourceMessageId: value.sourceMessageId,
            }),
          )
        : undefined
    const receipt = async () => {
      const [row] = await db.execute<{
        request_digest: string | null
        conversation_id: string
        parent_conversation_id: string
        source_message_id: string
      }>(
        sql`SELECT request_digest,conversation_id,parent_conversation_id,source_message_id FROM chat_thread_requests WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid AND idempotency_key=${idempotencyKey}::uuid`,
      )
      return row
        ? {
            ...row,
            request_digest:
              row.request_digest ??
              (value.kind === 'manual' &&
              row.parent_conversation_id === parentConversationId &&
              row.source_message_id === value.sourceMessageId
                ? legacyDigest!
                : ''),
          }
        : undefined
    }
    const resolveReceipt = async (row: {
      request_digest: string
      conversation_id: string
    }) => {
      if (
        row.request_digest !== requestDigest &&
        row.request_digest !== legacyDigest
      )
        throw new ConversationThreadError(
          value.kind === 'manual'
            ? 'This thread request was already used for a different message.'
            : 'This thread request was already used for a different thread.',
          409,
        )
      return this.get(row.conversation_id)
    }
    const previous = await receipt()
    if (previous) return resolveReceipt(previous)
    const [main] = await db.execute(
      sql`SELECT 1 FROM chat_conversation_mains cm JOIN chat_bots b ON b.id=cm.bot_id WHERE cm.conversation_id=${parentConversationId} AND cm.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.archived_at IS NULL AND b.deleted_at IS NULL`,
    )
    if (!main)
      throw new ConversationThreadError(
        'Start a thread from an active main conversation.',
        409,
      )
    let source: ThreadSource, conversationId: string, title: string
    if (value.kind === 'delegated') {
      source = value.source
      conversationId = value.conversationId
      title = value.title
    } else {
      const sourceStub = this.env.CONVERSATIONS.getByName(parentConversationId)
      await sourceStub.bindIdentity(parent)
      const captured = await sourceStub.captureThreadSource(
        parent,
        value.sourceMessageId,
      )
      if (!captured.ok)
        throw new ConversationThreadError(captured.error, captured.status)
      source = threadSourceSchema.parse(captured.source)
      conversationId = crypto.randomUUID()
      title = sourceTitle(source.text)
    }
    const now = Date.now()
    try {
      await db.transaction(async (tx) => {
        // Serialize parent admission so competing requests cannot exceed the quota.
        const [owner] = await tx.execute<{ bot_id: string }>(
          sql`SELECT c.bot_id FROM chat_conversations c JOIN chat_conversation_mains cm ON cm.conversation_id=c.id AND cm.bot_id=c.bot_id AND cm.user_id=c.user_id JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${parentConversationId} AND c.user_id=${this.userId}::uuid AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL AND b.archived_at IS NULL FOR UPDATE OF c,b FOR SHARE OF m`,
        )
        if (!owner) return
        const [existing] = await tx.execute(
          sql`SELECT 1 FROM chat_thread_requests WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid AND idempotency_key=${idempotencyKey}::uuid`,
        )
        if (existing) return
        const [quota] = await tx.execute<{ count: number }>(
          sql`SELECT count(*)::integer AS count FROM chat_conversation_threads WHERE parent_conversation_id=${parentConversationId}`,
        )
        if (quota.count >= maxConversationThreads) return
        await tx.execute(
          sql`INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES(${conversationId},${owner.bot_id},${this.userId}::uuid,${new Date(now).toISOString()}::timestamptz)`,
        )
        await tx.execute(
          sql`INSERT INTO chat_conversation_threads(conversation_id,parent_conversation_id,bot_id,user_id,source_message_id,source,title,version,archived_at) VALUES(${conversationId},${parentConversationId},${owner.bot_id},${this.userId}::uuid,${value.sourceMessageId},${JSON.stringify(source)}::jsonb,${title},0,NULL)`,
        )
        await tx.execute(
          sql`INSERT INTO chat_thread_requests(workspace_id,user_id,idempotency_key,parent_conversation_id,source_message_id,conversation_id,request_digest) VALUES(${this.workspaceId},${this.userId}::uuid,${idempotencyKey}::uuid,${parentConversationId},${value.sourceMessageId},${conversationId},${requestDigest})`,
        )
      })
    } catch {
      const existing = await receipt()
      if (existing) return resolveReceipt(existing)
      throw new ConversationThreadError(
        'The conversation changed before this thread could be created. Try again.',
        409,
      )
    }
    const created = await receipt()
    if (!created)
      throw new ConversationThreadError(
        'Thread creation is unavailable. Check access and the 100-thread limit, then retry.',
        409,
      )
    // Metadata and source context are complete before the empty DO is ever opened.
    return resolveReceipt(created)
  }
}
