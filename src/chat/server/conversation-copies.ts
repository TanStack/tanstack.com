import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  canonicalCopyJson,
  copyBoundarySchema,
  type CopyExportProgress,
  type CopyExportRequest,
  type CopyIdentity,
  type CopyKind,
  type CopyManifest,
  type CopyPage,
} from '../core/conversation-copy'
import { BotWorkspaceError } from './workspace-error'
import { hash } from './crypto'
import { resolveConversationIdentity } from '../conversation-identity.server'

const copyRequestSchema = z
  .object({
    idempotencyKey: z.string().min(1).max(128),
    kind: z.enum(['duplicate', 'fork']),
    boundary: copyBoundarySchema,
    name: z.string().trim().min(1).max(60).optional(),
    parentId: z.string().min(1).max(200).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.kind === 'duplicate' && value.boundary.kind === 'end') ||
      (value.kind === 'fork' && value.boundary.kind === 'message'),
    'Choose a matching copy boundary.',
  )

import type {
  ConversationCopyRow,
  CopyOperationView,
  CopyWakePort,
  CopyTargetPort,
} from './conversation-copy-contract'
export type { ConversationCopyRow } from './conversation-copy-contract'
export {
  getAuthorizedCopyOperation,
  resumeConversationCopies,
} from './conversation-copy-worker'
export interface CopyEnvironment {
  CONVERSATIONS: {
    getByName(id: string): CopyWakePort &
      CopyTargetPort & {
        bindIdentity(identity: CopyIdentity): Promise<unknown>
        copyBoundary(
          messageId: string,
        ): Promise<
          | { ok: true; boundary: z.infer<typeof copyBoundarySchema> }
          | { ok: false }
        >
      }
  }
}
const columns = sql.raw(
  `o.*,o.boundary_json::text AS boundary_json,o.manifest_json::text AS manifest_json,o.next_page::double precision AS next_page,o.work_version::double precision AS work_version,o.attempts::double precision AS attempts,o.retry_at::double precision AS retry_at,o.created_at::double precision AS created_at,o.updated_at::double precision AS updated_at,o.completed_at::double precision AS completed_at`,
)
function manifestFor(row: ConversationCopyRow): CopyManifest {
  if (!row.manifest_json) throw new Error('Copy manifest is missing.')
  return JSON.parse(row.manifest_json)
}
function view(row: ConversationCopyRow): CopyOperationView {
  return {
    operationId: row.id,
    status: row.status,
    ...(row.status === 'ready'
      ? {
          botId: row.target_bot_id,
          conversationId: row.target_conversation_id,
        }
      : {}),
    ...(row.status === 'failed'
      ? {
          error: {
            code: row.error_code ?? 'copy_failed',
            message:
              row.error_message ?? 'The conversation could not be copied.',
          },
        }
      : {}),
  }
}

export class ConversationCopies {
  constructor(
    readonly env: CopyEnvironment,
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
  private async member() {
    const [member] = await db.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid`,
    )
    if (!member) throw new BotWorkspaceError('Workspace not found.', 403)
  }
  private wake(
    row: Pick<ConversationCopyRow, 'source_conversation_id'>,
    registration?: { operationId: string; registerUntil: number },
  ) {
    const source: CopyWakePort = this.env.CONVERSATIONS.getByName(
      row.source_conversation_id,
    )
    return source.wakeCopies(registration)
  }
  private async owned(id: string) {
    await this.member()
    const [row] = await db.execute<
      ConversationCopyRow & Record<string, unknown>
    >(
      sql`SELECT ${columns} FROM chat_conversation_copies o WHERE id=${id}::uuid AND workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid`,
    )
    if (!row) throw new BotWorkspaceError('Copy operation not found.', 404)
    return row
  }
  async get(id: string) {
    const row = await this.owned(id)
    // Creation already registered a durable alarm before inserting the row.
    // A redundant wake failure must not hide the operation's durable status.
    if (row.phase !== 'done') await this.wake(row).catch(() => undefined)
    return view(row)
  }
  async getCopySource(targetBotId: string, conversationId?: string) {
    await this.member()
    const target = await resolveConversationIdentity({
      botId: targetBotId,
      conversationId,
      workspaceId: this.workspaceId,
      userId: this.userId,
    })
    const [row] = await db.execute<
      ConversationCopyRow & Record<string, unknown>
    >(
      sql`SELECT ${columns} FROM chat_conversation_copies o JOIN chat_conversations c ON c.id=o.target_conversation_id AND c.bot_id=o.target_bot_id AND c.user_id=o.user_id WHERE o.target_bot_id=${targetBotId} AND o.workspace_id=${this.workspaceId} AND o.user_id=${this.userId}::uuid AND o.status='ready' AND o.target_conversation_id=${target.conversationId}`,
    )
    if (!row) throw new BotWorkspaceError('Copy source not found.', 404)
    const readSource = async (): Promise<{
      botId: string
      name: string
    } | null> => {
      const [source] = await db.execute<{ botId: string; name: string }>(
        sql`SELECT b.id AS "botId",COALESCE(t.title,b.name) AS name FROM chat_bots b JOIN chat_conversations c ON c.bot_id=b.id AND c.user_id=${this.userId}::uuid LEFT JOIN chat_conversation_threads t ON t.conversation_id=c.id WHERE b.id=${row.source_bot_id} AND b.workspace_id=${this.workspaceId} AND c.id=${row.source_conversation_id} AND b.deleted_at IS NULL`,
      )
      return source ?? null
    }
    let source = await readSource()
    const manifest = manifestFor(row)
    if (source && manifest.sourceMessageId) {
      const current = await this.env.CONVERSATIONS.getByName(
        row.source_conversation_id,
      )
        .copyBoundary(manifest.sourceMessageId)
        .catch(() => null)
      if (
        !current?.ok ||
        current.boundary.epoch !== manifest.sourceEpoch ||
        current.boundary.kind !== 'message' ||
        (manifest.sourceMessageDigest !== null &&
          current.boundary.expectedDigest !== manifest.sourceMessageDigest)
      )
        source = null
    }
    // The boundary RPC may outlive a membership change or source deletion.
    await this.member()
    await resolveConversationIdentity(target)
    if (source) source = await readSource()
    return {
      operationId: row.id,
      kind: row.kind,
      copiedAt: row.completed_at!,
      ...(source
        ? {
            source: {
              ...source,
              conversationId: row.source_conversation_id,
              messageId: manifest.sourceMessageId,
              ...(manifest.sourceMessagePosition
                ? { messagePosition: manifest.sourceMessagePosition }
                : {}),
            },
          }
        : {}),
    }
  }
  async create(
    sourceBotId: string,
    input: unknown,
    sourceConversationId?: string,
    retryId?: string,
  ): Promise<CopyOperationView> {
    await this.member()
    const value = copyRequestSchema.parse(input)
    const requestDigest = await hash(
      canonicalCopyJson({
        sourceBotId,
        ...value,
        ...(retryId ? { retryId } : {}),
      }),
    )
    const [existing] = await db.execute<
      ConversationCopyRow & Record<string, unknown>
    >(
      sql`SELECT ${columns} FROM chat_conversation_copies o WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid AND idempotency_key=${value.idempotencyKey}`,
    )
    if (existing) {
      if (
        existing.request_digest !== requestDigest ||
        (existing.retry_id ?? undefined) !== retryId ||
        (sourceConversationId !== undefined &&
          existing.source_conversation_id !== sourceConversationId)
      )
        throw new BotWorkspaceError(
          'This copy request key was already used with different options.',
          409,
        )
      if (existing.phase !== 'done')
        await this.wake(existing).catch(() => undefined)
      return view(existing)
    }
    if (retryId) {
      const [retry] = await db.execute<{ source_json: string }>(
        sql`SELECT source_json::text AS source_json FROM chat_conversation_retries WHERE id=${retryId}::uuid AND workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid AND source_bot_id=${sourceBotId} AND source_conversation_id=${sourceConversationId ?? null} AND status='preparing'`,
      )
      if (
        !retry ||
        value.kind !== 'fork' ||
        canonicalCopyJson(JSON.parse(retry.source_json).boundary) !==
          canonicalCopyJson(value.boundary)
      )
        throw new BotWorkspaceError('This retry review is unavailable.', 409)
    }
    const [source] = await db.execute<{
      id: string
      name: string
      purpose: string
      parent_id: string | null
      archived_at: Date | null
      deleted_at: Date | null
      conversation_id: string
    }>(
      sql`SELECT b.id,b.purpose,b.parent_id,COALESCE(t.title,b.name) AS name,b.archived_at,b.deleted_at,c.id AS conversation_id FROM chat_bots b JOIN chat_conversations c ON c.bot_id=b.id AND c.user_id=${this.userId}::uuid LEFT JOIN chat_conversation_threads t ON t.conversation_id=c.id WHERE b.id=${sourceBotId} AND b.workspace_id=${this.workspaceId} AND ((${sourceConversationId ?? null}::text IS NOT NULL AND c.id=${sourceConversationId ?? null}) OR (${sourceConversationId ?? null}::text IS NULL AND EXISTS(SELECT 1 FROM chat_conversation_mains main WHERE main.conversation_id=c.id AND main.bot_id=c.bot_id AND main.user_id=c.user_id)))`,
    )
    if (!source) throw new BotWorkspaceError('Conversation not found.', 404)
    if (source.deleted_at !== null)
      throw new BotWorkspaceError(
        'Restore this conversation before copying it.',
        409,
      )
    let parentId = value.parentId
    if (parentId === undefined) {
      parentId =
        value.kind === 'fork' && source.archived_at === null
          ? source.id
          : source.parent_id
      const visited = new Set<string>()
      while (parentId) {
        if (visited.has(parentId))
          throw new BotWorkspaceError(
            'The conversation hierarchy is invalid.',
            409,
          )
        visited.add(parentId)
        const [parent]: Array<{
          parent_id: string | null
          archived_at: Date | null
          deleted_at: Date | null
        }> = await db.execute(
          sql`SELECT parent_id,archived_at,deleted_at FROM chat_bots WHERE id=${parentId} AND workspace_id=${this.workspaceId}`,
        )
        if (!parent)
          throw new BotWorkspaceError('Parent conversation not found.', 404)
        if (parent.archived_at === null && parent.deleted_at === null) break
        parentId = parent.parent_id
      }
    } else if (parentId !== null) {
      const [parent] = await db.execute(
        sql`SELECT 1 FROM chat_bots WHERE id=${parentId} AND workspace_id=${this.workspaceId} AND archived_at IS NULL AND deleted_at IS NULL`,
      )
      if (!parent)
        throw new BotWorkspaceError(
          'Choose an active parent conversation in this workspace.',
          409,
        )
    }
    const now = Date.now(),
      id = crypto.randomUUID(),
      botId = crypto.randomUUID()
    const row = {
      id,
      source_conversation_id: source.conversation_id,
    }
    const registerUntil = now + 120_000
    // Register durable wake intent before D1. Its expiry and this SQL deadline
    // prevent a crash between storage systems from leaving an unscheduled job.
    const sourceStub = this.env.CONVERSATIONS.getByName(source.conversation_id)
    await sourceStub.bindIdentity({
      conversationId: source.conversation_id,
      botId: source.id,
      userId: this.userId,
      workspaceId: this.workspaceId,
    })
    await this.wake(row, { operationId: id, registerUntil })
    await db.transaction(async (tx) => {
      const [authorized] = await tx.execute(
        sql`SELECT b.id FROM chat_bots b JOIN chat_conversations c ON c.bot_id=b.id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE b.id=${source.id} AND b.workspace_id=${this.workspaceId} AND c.id=${source.conversation_id} AND c.user_id=${this.userId}::uuid AND b.deleted_at IS NULL FOR SHARE OF b,c,m`,
      )
      if (!authorized) return
      if (parentId) {
        const [parent] = await tx.execute(
          sql`SELECT id FROM chat_bots WHERE id=${parentId} AND workspace_id=${this.workspaceId} AND archived_at IS NULL AND deleted_at IS NULL FOR SHARE`,
        )
        if (!parent) return
      }
      await tx.execute(sql`INSERT INTO chat_conversation_copies(id,workspace_id,user_id,source_bot_id,source_conversation_id,target_bot_id,target_conversation_id,idempotency_key,request_digest,kind,boundary_json,name,purpose,parent_id,created_at,updated_at,retry_id)
       SELECT ${id}::uuid,${this.workspaceId},${this.userId}::uuid,${source.id},${source.conversation_id},${botId},${'chat:' + botId + ':' + this.userId},${value.idempotencyKey},${requestDigest},${value.kind},${canonicalCopyJson(value.boundary)}::jsonb,${value.name ?? source.name.slice(0, 53) + ' (copy)'},${source.purpose},${parentId ?? null},${now},${now},${retryId ?? null}::uuid WHERE extract(epoch from clock_timestamp())*1000<${registerUntil} ON CONFLICT DO NOTHING`)
    })
    const [stored] = await db.execute<
      ConversationCopyRow & Record<string, unknown>
    >(
      sql`SELECT ${columns} FROM chat_conversation_copies o WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}::uuid AND idempotency_key=${value.idempotencyKey}`,
    )
    if (!stored)
      throw new BotWorkspaceError(
        'Access or the copy registration changed. Try again.',
        409,
      )
    if (
      stored.request_digest !== requestDigest ||
      (stored.retry_id ?? undefined) !== retryId ||
      stored.source_conversation_id !== source.conversation_id
    )
      throw new BotWorkspaceError(
        'This copy request key was already used with different options.',
        409,
      )
    await this.wake(stored).catch(() => undefined)
    return view(stored)
  }
}
