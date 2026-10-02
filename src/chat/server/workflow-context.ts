import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { ModelEnvironment } from './run-models'
type ConversationIdentity = z.infer<typeof conversationRunIdentitySchema>
import { conversationRunIdentitySchema } from '../core/conversation-runs'
import { z } from 'zod'
import { policySchema } from '../core/types'
import type { RunModelSelection } from '../core/run-model'
import { canonicalCopyJson } from '../core/conversation-copy'
import { ConversationIdentityError } from '../conversation-identity.server'
import { resolveRunModel } from './run-models'

/** Reads current execution access, not just permission to inspect old receipts.
 * The caller supplies authenticated identity and separately checks run liveness.
 * No provider credentials are returned or persisted in a workflow record. */
export async function resolveWorkflowContext(
  env: ModelEnvironment,
  rawIdentity: ConversationIdentity,
  selection?: RunModelSelection,
  childConversationId?: string,
) {
  const identity = conversationRunIdentitySchema.parse(rawIdentity)
  const childId = z
    .string()
    .min(1)
    .max(1000)
    .optional()
    .parse(childConversationId)
  const read = async () => {
    const [row] = await db.execute<{ policy: string }>(sql`
      SELECT w.policy::text AS policy FROM chat_conversations c
      JOIN chat_bots b ON b.id=c.bot_id
      JOIN chat_workspaces w ON w.id=b.workspace_id
      JOIN chat_memberships member ON member.workspace_id=w.id AND member.user_id=c.user_id
      WHERE c.id=${identity.conversationId} AND c.user_id=${identity.userId} AND b.id=${identity.botId} AND w.id=${identity.workspaceId}
        AND b.deleted_at IS NULL AND b.archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM chat_conversation_threads t WHERE t.conversation_id=c.id AND t.archived_at IS NOT NULL)
        AND (${childId ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM chat_conversations child
          WHERE child.id=${childId ?? null} AND child.bot_id=b.id AND child.user_id=c.user_id
            AND NOT EXISTS (SELECT 1 FROM chat_conversation_threads t WHERE t.conversation_id=child.id AND t.archived_at IS NOT NULL)
        ))`)
    if (!row) throw new ConversationIdentityError()
    const policy = policySchema.parse(JSON.parse(row.policy))
    if (!policy.allowChatModels)
      throw Error('Workflows need an allowed Assistant model.')
    return policy
  }
  const policy = await read()
  const model = await resolveRunModel(env, {
    userId: identity.userId,
    policy,
    fixture: false,
    selection,
  })
  // Configuration lookup can await credential storage. Do not return an old
  // access decision if membership, lifecycle or policy changed during it.
  const current = await read()
  if (canonicalCopyJson(current) !== canonicalCopyJson(policy))
    throw Error('Workspace policy changed. Check workflow access again.')
  return { identity, policy: current, model: model.selection }
}
