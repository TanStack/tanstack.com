import { markConversationRead } from './bot-activity'
import { z } from 'zod'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { policySchema, type Bot, type Recipe } from '../core/types'

/** Native PostgreSQL boundaries extracted from Conversation.guardActive and run contexts.
 * The Conversation still authorizes and binds its exact identity before these internal reads.
 */
export async function readConversationLifecycle(
  botId: string,
  conversationId: string,
) {
  const [row] = await db.execute<{
    bot_id: string | null
    bot_archived_at: number | null
    bot_deleted_at: number | null
    thread_id: string | null
    thread_archived_at: number | null
  }>(sql`SELECT b.id AS bot_id,
    trunc(extract(epoch FROM b.archived_at)*1000)::float8 AS bot_archived_at,
    trunc(extract(epoch FROM b.deleted_at)*1000)::float8 AS bot_deleted_at,
    t.conversation_id AS thread_id,
    trunc(extract(epoch FROM t.archived_at)*1000)::float8 AS thread_archived_at
    FROM (SELECT 1) anchor
    LEFT JOIN chat_bots b ON b.id=${botId}
    LEFT JOIN chat_conversation_threads t ON t.conversation_id=${conversationId}`)
  return {
    bot: row?.bot_id
      ? { archived_at: row.bot_archived_at, deleted_at: row.bot_deleted_at }
      : null,
    thread: row?.thread_id ? { archived_at: row.thread_archived_at } : null,
  }
}
export async function conversationRetryReady(input: {
  retryId: string
  operationId: string
  conversationId: string
  userId: string
  workspaceId: string
}) {
  if (
    ![input.retryId, input.operationId, input.userId].every(
      (id) => z.string().uuid().safeParse(id).success,
    )
  )
    return false
  const rows =
    await db.execute(sql`SELECT 1 FROM chat_conversation_retries retry JOIN chat_conversation_copies copy ON copy.retry_id=retry.id
    WHERE retry.id=${input.retryId} AND retry.status='ready' AND copy.id=${input.operationId} AND copy.status='ready'
    AND copy.target_conversation_id=${input.conversationId} AND copy.user_id=${input.userId} AND copy.workspace_id=${input.workspaceId}`)
  return rows.length > 0
}
export async function readConversationRunContext(
  identity: {
    workspaceId: string
    userId: string
    botId: string
  },
  loadSavedActions = true,
) {
  // One statement supplies a coherent snapshot without a transaction handshake.
  const [row] = await db.execute<{
    policy: unknown
    bot: Bot
    recipes: Recipe[]
  }>(sql`SELECT w.policy,
    jsonb_build_object('id',b.id,'workspace_id',b.workspace_id,'parent_id',b.parent_id,
      'name',b.name,'purpose',b.purpose,
      'created_at',trunc(extract(epoch FROM b.created_at)*1000)::float8) AS bot,
    CASE WHEN ${loadSavedActions} THEN COALESCE((SELECT jsonb_agg(r ORDER BY r.created_at)
      FROM (SELECT id,workspace_id,title,description,code,created_at::float8 AS created_at
        FROM chat_recipes WHERE workspace_id=w.id ORDER BY created_at LIMIT 30) r),
      '[]'::jsonb) ELSE '[]'::jsonb END AS recipes
    FROM chat_workspaces w
    JOIN chat_memberships m ON m.workspace_id=w.id AND m.user_id=${identity.userId}
    JOIN chat_bots b ON b.workspace_id=w.id AND b.id=${identity.botId}
    WHERE w.id=${identity.workspaceId}`)
  if (!row) throw new Error('Workspace access is unavailable.')
  return {
    bot: row.bot,
    policy: policySchema.parse(row.policy),
    recipes: row.recipes,
    userId: identity.userId,
  }
}

/** Source activateCopyImport publication checks, after the copy and identity have been authorized. */
export async function confirmCopyActivityPublication(input: {
  workspaceId: string
  userId: string
  conversationId: string
  version: number
  messageCount: number
}) {
  const [projected] = await db.execute<
    { event_version: number; message_count: number } & Record<string, unknown>
  >(
    sql`SELECT event_version::float8 AS event_version,message_count::float8 AS message_count FROM chat_conversation_activity WHERE conversation_id=${input.conversationId}`,
  )
  if (
    !projected ||
    projected.event_version < input.version ||
    projected.message_count !== input.messageCount
  )
    throw new Error('The copied activity is still being published.')
  await markConversationRead(
    input.workspaceId,
    input.userId,
    input.conversationId,
    input.version,
  )
  const [read] = await db.execute<
    { read_version: number } & Record<string, unknown>
  >(
    sql`SELECT read_version::float8 AS read_version FROM chat_conversation_activity WHERE conversation_id=${input.conversationId}`,
  )
  if (!read || read.read_version < input.version)
    throw new Error('The copied read watermark is still being published.')
}
export async function conversationCopyPublished(conversationId: string) {
  return (
    (
      await db.execute(
        sql`SELECT id FROM chat_conversations WHERE id=${conversationId}`,
      )
    ).length > 0
  )
}

/** Source workflow result reconnection, after owner/admission authorization. */
export async function workflowChildPublished(identity: {
  conversationId: string
  botId: string
  userId: string
}) {
  return (
    (
      await db.execute(
        sql`SELECT 1 FROM chat_conversations WHERE id=${identity.conversationId} AND bot_id=${identity.botId} AND user_id=${identity.userId}`,
      )
    ).length > 0
  )
}
/** Source router account hint and final usage settlement reads. */
export async function readKodyUsername(userId: string) {
  const [row] = await db.execute<
    { username: string } & Record<string, unknown>
  >(sql`SELECT username FROM chat_kody_links WHERE user_id=${userId}`)
  return row ?? null
}
export async function readRunUsageStart(conversationId: string, runId: string) {
  const [row] = await db.execute<
    { created_at: number } & Record<string, unknown>
  >(
    sql`SELECT created_at::float8 AS created_at FROM chat_run_usage_receipts WHERE conversation_id=${conversationId} AND run_id=${runId}`,
  )
  return row ?? null
}

/** Original workflow-child metadata lookup, called after conversation authorization. */
export async function readConversationWorkflowWorker(conversationId: string) {
  const [row] = await db.execute<
    { ownerConversationId: string; runId: string; stepId: string } & Record<
      string,
      unknown
    >
  >(
    sql`SELECT owner_conversation_id AS "ownerConversationId",workflow_run_id AS "runId",step_id AS "stepId" FROM chat_workflow_children WHERE conversation_id=${conversationId}`,
  )
  return row ?? null
}
export async function readConversationWorkflowOwner(conversationId: string) {
  return (
    (await readConversationWorkflowWorker(conversationId))
      ?.ownerConversationId ?? null
  )
}
