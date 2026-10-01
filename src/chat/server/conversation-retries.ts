import { z } from 'zod'
import { canonicalCopyJson } from '../core/conversation-copy'
import type {
  RetryAttemptView,
  RetryPreparationSnapshot,
} from '../core/conversation-retry'
import { createRetryFilePlan, type RetryFilePlan } from '../core/retry-files'
import { parseRetrySource, type RetrySourceResult } from '../core/retry-source'
import { referenceInput } from '../core/message-references'
import type { Policy } from '../core/types'
import { BotWorkspaceError } from './workspace-error'
import {
  ConversationCopies,
  type ConversationCopyRow,
} from './conversation-copies'
import { resolveConversationIdentity } from '../conversation-identity.server'
import { resolveMessageReferences } from './message-references'
import { SavedFiles } from './saved-files'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { CopyEnvironment } from './conversation-copies'
import type { ReferenceEnvironment } from './message-references'
type ConversationIdentity = Awaited<
  ReturnType<typeof resolveConversationIdentity>
>
export type RetryEnvironment = Omit<ReferenceEnvironment, 'CONVERSATIONS'> & {
  CONVERSATIONS: {
    getByName(id: string): ReturnType<
      CopyEnvironment['CONVERSATIONS']['getByName']
    > &
      ReturnType<ReferenceEnvironment['CONVERSATIONS']['getByName']> & {
        bindIdentity(identity: ConversationIdentity): Promise<unknown>
        captureRetrySourceJson(
          identity: ConversationIdentity,
          messageId: string,
          options: { policy: Policy; fixture: boolean },
        ): Promise<string>
        retryPreparationSnapshot(
          identity: ConversationIdentity,
          attemptId: string,
          evidenceDigest: string,
        ): Promise<RetryPreparationSnapshot>
      }
  }
}

import type { ConversationRetryRow } from './copy-retry-source'
export type { ConversationRetryRow } from './copy-retry-source'
export { copyRetrySource } from './copy-retry-source'
const retryRequestSchema = z.strictObject({
  idempotencyKey: z.string().uuid(),
  messageId: z.string().min(1).max(128),
})

/** Preparation advances only on an explicit idempotent command. Reading status
 * never submits a message. Every step can resume under the same saved identities.
 */
export class ConversationRetries {
  constructor(
    private env: RetryEnvironment,
    private workspaceId: string,
    private userId: string,
  ) {}
  private async member() {
    if (
      !(await (
        await db.execute(
          sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}`,
        )
      )[0])
    )
      throw new BotWorkspaceError('Workspace not found.', 404)
  }
  private async owned(id: string) {
    await this.member()
    const row = (
      await db.execute<ConversationRetryRow & Record<string, unknown>>(
        sql`SELECT *,source_json::text AS source_json,file_plan_json::text AS file_plan_json,created_at::float8 AS created_at,updated_at::float8 AS updated_at FROM chat_conversation_retries WHERE id=${id} AND workspace_id=${this.workspaceId} AND user_id=${this.userId}`,
      )
    )[0]
    if (!row) throw new BotWorkspaceError('Retry attempt not found.', 404)
    return row
  }
  private async copy(row: ConversationRetryRow) {
    return (
      await db.execute<ConversationCopyRow & Record<string, unknown>>(
        sql`SELECT *,boundary_json::text AS boundary_json,manifest_json::text AS manifest_json,next_page::float8 AS next_page,work_version::float8 AS work_version,attempts::float8 AS attempts,retry_at::float8 AS retry_at,created_at::float8 AS created_at,updated_at::float8 AS updated_at,completed_at::float8 AS completed_at FROM chat_conversation_copies WHERE retry_id=${row.id} AND workspace_id=${this.workspaceId} AND user_id=${this.userId}`,
      )
    )[0]
  }
  private async target(copy: ConversationCopyRow) {
    const identity = await resolveConversationIdentity({
      workspaceId: this.workspaceId,
      userId: this.userId,
      botId: copy.target_bot_id,
      conversationId: copy.target_conversation_id,
    })
    const metadata = (
      await db.execute<
        { archived_at: number | null; deleted_at: number | null } & Record<
          string,
          unknown
        >
      >(
        sql`SELECT (extract(epoch FROM archived_at)*1000)::float8 AS archived_at,(extract(epoch FROM deleted_at)*1000)::float8 AS deleted_at FROM chat_bots WHERE id=${identity.botId}`,
      )
    )[0]
    if (
      !metadata ||
      metadata.archived_at !== null ||
      metadata.deleted_at !== null
    )
      throw new BotWorkspaceError(
        'Restore the new conversation before preparing this request.',
        409,
      )
    return identity
  }
  async get(id: string): Promise<RetryAttemptView> {
    const row = await this.owned(id)
    const copy = await this.copy(row)
    const view: RetryAttemptView = {
      attemptId: row.id,
      status: row.status,
      ...(row.error_code && row.error_message
        ? { error: { code: row.error_code, message: row.error_message } }
        : {}),
    }
    if (!copy || copy.status !== 'ready') return view
    const target = await this.target(copy)
    view.target = { botId: target.botId, conversationId: target.conversationId }
    const source = parseRetrySource(JSON.parse(row.source_json))
    const resetView = (
      snapshot: RetryPreparationSnapshot,
    ): RetryAttemptView => ({
      ...view,
      status: 'failed',
      error: {
        code: 'target_reset',
        message:
          'This retry conversation was reset. Start a new attempt from the original request.',
      },
      evidence: source.evidence,
      submittedMessageId: snapshot.submittedMessageId,
      submittedDraftRevision: snapshot.submittedDraftRevision,
      draft: undefined,
    })
    const snapshot = await this.env.CONVERSATIONS.getByName(
      target.conversationId,
    ).retryPreparationSnapshot(target, row.id, source.evidenceDigest)
    if (snapshot.reset) return resetView(snapshot)
    view.evidence = source.evidence
    if (snapshot.submittedMessageId) {
      view.submittedMessageId = snapshot.submittedMessageId
      view.submittedDraftRevision = snapshot.submittedDraftRevision
    }
    if (row.status === 'ready' && !snapshot.submittedMessageId) {
      const plan: RetryFilePlan = JSON.parse(row.file_plan_json)
      const files = new SavedFiles(this.env, target)
      const attachments = await Promise.all(
        plan.imports.map(async (item) => {
          const file = await files.get(item.targetFileId)
          if (
            file.state !== 'ready' ||
            file.sha256 !== item.source.sha256 ||
            file.size !== item.source.size ||
            file.name !== item.source.name ||
            file.mediaType !== item.source.mediaType ||
            file.source !== item.source.source
          )
            throw new BotWorkspaceError(
              'A restored attachment is unavailable. Restore it before trying again.',
              409,
            )
          return {
            ...file,
            state: 'ready' as const,
            botId: target.botId,
            conversationId: target.conversationId,
          }
        }),
      )
      view.draft = {
        request: {
          ...source.request,
          attachments,
          references: plan.references,
        },
        evidenceDigest: source.evidenceDigest,
      }
    }
    // File reads yield. Do not return a private draft after revocation.
    await this.member()
    await this.target(copy)
    const current = await this.env.CONVERSATIONS.getByName(
      target.conversationId,
    ).retryPreparationSnapshot(target, row.id, source.evidenceDigest)
    if (current.reset) return resetView(current)
    if (current.submittedMessageId) {
      view.submittedMessageId = current.submittedMessageId
      view.submittedDraftRevision = current.submittedDraftRevision
      delete view.draft
    }
    return view
  }
  async create(
    identity: ConversationIdentity,
    input: unknown,
    options: { policy: Policy; fixture: boolean },
  ) {
    const value = retryRequestSchema.parse(input)
    await this.member()
    if (
      identity.workspaceId !== this.workspaceId ||
      identity.userId !== this.userId
    )
      throw new BotWorkspaceError('Conversation not found.', 404)
    let row = (
      await db.execute<ConversationRetryRow & Record<string, unknown>>(
        sql`SELECT *,source_json::text AS source_json,file_plan_json::text AS file_plan_json,created_at::float8 AS created_at,updated_at::float8 AS updated_at FROM chat_conversation_retries WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} AND idempotency_key=${value.idempotencyKey}`,
      )
    )[0]
    if (!row) {
      const exact = await resolveConversationIdentity(identity)
      const stub = this.env.CONVERSATIONS.getByName(exact.conversationId)
      await stub.bindIdentity(exact)
      const review: RetrySourceResult = JSON.parse(
        await stub.captureRetrySourceJson(exact, value.messageId, options),
      )
      if (!review.ok) throw new BotWorkspaceError(review.error, review.status)
      const plan = createRetryFilePlan(review.source.request)
      const id = crypto.randomUUID(),
        now = Date.now()
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalCopyJson(['chat-retry-admission', this.workspaceId, this.userId])},0))`,
        )
        const [current] = await tx.execute(
          sql`SELECT 1 FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${exact.conversationId} AND c.bot_id=${exact.botId} AND c.user_id=${this.userId} AND b.workspace_id=${this.workspaceId} AND b.deleted_at IS NULL FOR SHARE OF c,b,m`,
        )
        if (!current)
          throw new BotWorkspaceError('Conversation not found.', 404)
        await tx.execute(sql`INSERT INTO chat_conversation_retries
        (id,workspace_id,user_id,source_bot_id,source_conversation_id,message_id,idempotency_key,source_json,file_plan_json,created_at,updated_at)
        SELECT ${id},${this.workspaceId},${this.userId},${exact.botId},${exact.conversationId},${value.messageId},${value.idempotencyKey},${canonicalCopyJson(review.source)}::jsonb,${canonicalCopyJson(plan)}::jsonb,${now},${now} WHERE EXISTS(
          SELECT 1 FROM chat_memberships m JOIN chat_bots b ON b.workspace_id=m.workspace_id

          JOIN chat_conversations c ON c.bot_id=b.id AND c.user_id=m.user_id
          WHERE m.workspace_id=${this.workspaceId} AND m.user_id=${this.userId} AND b.id=${exact.botId} AND c.id=${exact.conversationId} AND b.deleted_at IS NULL)
        AND (SELECT count(*) FROM chat_conversation_retries WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}) < 200 ON CONFLICT DO NOTHING`)
      })
      row = (
        await db.execute<ConversationRetryRow & Record<string, unknown>>(
          sql`SELECT *,source_json::text AS source_json,file_plan_json::text AS file_plan_json,created_at::float8 AS created_at,updated_at::float8 AS updated_at FROM chat_conversation_retries WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} AND idempotency_key=${value.idempotencyKey}`,
        )
      )[0]
      if (!row)
        throw new BotWorkspaceError(
          'Retry preparation is unavailable. Check access and the 200-attempt preview limit.',
          409,
        )
    }
    if (
      row.source_bot_id !== identity.botId ||
      row.source_conversation_id !== identity.conversationId ||
      row.message_id !== value.messageId
    )
      throw new BotWorkspaceError(
        'This retry key was already used for a different request.',
        409,
      )
    return this.prepare(row.id, options)
  }
  async prepare(
    id: string,
    options: { policy: Policy; fixture: boolean },
  ): Promise<RetryAttemptView> {
    const row = await this.owned(id)
    if (row.status !== 'preparing') return this.get(row.id)
    const source = parseRetrySource(JSON.parse(row.source_json))
    const plan: RetryFilePlan = JSON.parse(row.file_plan_json)
    try {
      const copies = new ConversationCopies(
        this.env,
        this.workspaceId,
        this.userId,
      )
      const operation = await copies.create(
        row.source_bot_id,
        {
          idempotencyKey: `retry:${row.id}`,
          kind: 'fork',
          boundary: source.boundary,
        },
        row.source_conversation_id,
        row.id,
      )
      if (operation.status === 'failed') {
        await db.execute(
          sql`UPDATE chat_conversation_retries SET status='failed',error_code=${operation.error?.code ?? 'copy_failed'},error_message=${operation.error?.message ?? 'The branch could not be prepared.'},updated_at=${Date.now()} WHERE id=${row.id} AND status='preparing'`,
        )
        return this.get(row.id)
      }
      // A resumed creation has progressed past its previous transient failure.
      // Do not make clients stop polling on an old quota or registration error.
      await db.execute(
        sql`UPDATE chat_conversation_retries SET error_code=NULL,error_message=NULL,updated_at=${Date.now()} WHERE id=${row.id} AND status='preparing' AND error_code IS NOT NULL`,
      )
      if (operation.status !== 'ready') return this.get(row.id)
      const copy = await this.copy(row)
      if (!copy || copy.id !== operation.operationId)
        throw new Error('The retry branch could not be verified.')
      const target = await this.target(copy)
      const captured = await this.env.CONVERSATIONS.getByName(
        target.conversationId,
      ).retryPreparationSnapshot(target, row.id, source.evidenceDigest)
      if (captured.reset) return this.get(row.id)
      const files = new SavedFiles(this.env, target)
      for (const item of plan.imports) {
        // Matching legacy references still resolve through the explicit main mapping.
        const original = item.source.conversationId
          ? { conversationId: item.source.conversationId }
          : await resolveConversationIdentity({
              userId: this.userId,
              workspaceId: this.workspaceId,
              botId: item.source.botId,
              conversationId: item.source.conversationId,
            })
        await files.importFrom(
          original.conversationId,
          item.source.id,
          item.targetFileId,
          item.source.sha256,
        )
      }
      await resolveMessageReferences(
        this.env,
        target,
        plan.references.map(referenceInput),
        options,
      )
      const checked = await this.env.CONVERSATIONS.getByName(
        target.conversationId,
      ).retryPreparationSnapshot(target, row.id, source.evidenceDigest)
      if (checked.reset) return this.get(row.id)
      // Publishing readiness is the write gate. Recheck destination membership/lifecycle
      // in this same SQL statement after all asynchronous copy and input checks.
      await db.execute(sql`UPDATE chat_conversation_retries SET status='ready',error_code=NULL,error_message=NULL,updated_at=${Date.now()}
         WHERE id=${row.id} AND status='preparing' AND EXISTS(
          SELECT 1 FROM chat_conversation_copies copy JOIN chat_conversations c ON c.id=copy.target_conversation_id
          JOIN chat_bots b ON b.id=c.bot_id
          JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id
          WHERE copy.retry_id=chat_conversation_retries.id AND copy.status='ready' AND copy.target_bot_id=b.id
          AND c.user_id=chat_conversation_retries.user_id AND m.workspace_id=chat_conversation_retries.workspace_id
          AND b.archived_at IS NULL AND b.deleted_at IS NULL)`)
      return this.get(row.id)
    } catch (error) {
      // Interrupted transfers keep the same branch and file IDs. A late failure
      // from a competing preparer must not overwrite an already ready attempt.
      await db.execute(
        sql`UPDATE chat_conversation_retries SET error_code='preparation_incomplete',error_message=${
          error instanceof Error
            ? error.message
            : 'Preparation was interrupted. Resume this attempt.'
        },updated_at=${Date.now()} WHERE id=${row.id} AND status='preparing'`,
      )
      return this.get(row.id)
    }
  }
}
