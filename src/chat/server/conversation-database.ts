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
  const [bot] = await db.execute<
    { archived_at: number | null; deleted_at: number | null } & Record<
      string,
      unknown
    >
  >(
    sql`SELECT trunc(extract(epoch FROM archived_at)*1000)::float8 AS archived_at,trunc(extract(epoch FROM deleted_at)*1000)::float8 AS deleted_at FROM chat_bots WHERE id=${botId}`,
  )
  const [thread] = await db.execute<
    { archived_at: number | null } & Record<string, unknown>
  >(
    sql`SELECT trunc(extract(epoch FROM archived_at)*1000)::float8 AS archived_at FROM chat_conversation_threads WHERE conversation_id=${conversationId}`,
  )
  return { bot: bot ?? null, thread: thread ?? null }
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
  return db.transaction(
    async (tx) => {
      const [workspace] = await tx.execute<
        { policy: unknown } & Record<string, unknown>
      >(
        sql`SELECT w.policy FROM chat_workspaces w JOIN chat_memberships m ON m.workspace_id=w.id WHERE w.id=${identity.workspaceId} AND m.user_id=${identity.userId}`,
      )
      const [bot] = await tx.execute<Bot & Record<string, unknown>>(
        sql`SELECT id,workspace_id,parent_id,name,purpose,trunc(extract(epoch FROM created_at)*1000)::float8 AS created_at FROM chat_bots WHERE id=${identity.botId} AND workspace_id=${identity.workspaceId}`,
      )
      if (!workspace || !bot)
        throw new Error('Workspace access is unavailable.')
      const policy = policySchema.parse(workspace.policy)
      const recipes = loadSavedActions
        ? Array.from(
            await tx.execute<Recipe & Record<string, unknown>>(
              sql`SELECT id,workspace_id,title,description,code,created_at::float8 AS created_at FROM chat_recipes WHERE workspace_id=${identity.workspaceId} ORDER BY created_at LIMIT 30`,
            ),
          )
        : []
      return { bot, policy, recipes, userId: identity.userId }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
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
