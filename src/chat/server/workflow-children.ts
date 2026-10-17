import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { ModelEnvironment } from './run-models'
import { canonicalCopyJson } from '../core/conversation-copy'
import { workflowStepAdmissionSchema } from '../core/workflow-admission'
import { resolveWorkflowContext } from './workflow-context'

/** Publishes exact journaled child identity, not a fabricated message thread. */
export async function publishWorkflowChild(
  env: ModelEnvironment,
  raw: unknown,
) {
  const admission = workflowStepAdmissionSchema.parse(raw)
  const owner = admission.owner
  await resolveWorkflowContext(env, owner, admission.model)
  const receipt = async () => {
    const [row] = await db.execute<{ admission_json: string }>(
      sql`SELECT admission_json FROM chat_workflow_children WHERE conversation_id=${admission.childConversationId}`,
    )
    if (row && row.admission_json !== canonicalCopyJson(admission))
      throw Error('Workflow child belongs to another admission.')
    return !!row
  }
  if (!(await receipt())) {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO chat_conversations(id,bot_id,user_id,created_at)
     SELECT ${admission.childConversationId},c.bot_id,c.user_id,${new Date(admission.createdAt).toISOString()}::timestamptz FROM chat_conversations c
     JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships member ON member.workspace_id=b.workspace_id AND member.user_id=c.user_id
     WHERE c.id=${owner.conversationId} AND c.bot_id=${owner.botId} AND c.user_id=${owner.userId} AND b.workspace_id=${owner.workspaceId}
     AND b.deleted_at IS NULL AND b.archived_at IS NULL
     AND NOT EXISTS(SELECT 1 FROM chat_conversation_threads t WHERE t.conversation_id=c.id AND t.archived_at IS NOT NULL)`)
        await tx.execute(
          sql`INSERT INTO chat_workflow_children VALUES(${admission.childConversationId},${owner.conversationId},${admission.workflowRunId},${admission.stepId},${canonicalCopyJson(admission)})`,
        )
      })
    } catch (error) {
      if (!(await receipt())) throw error
    }
  }
  await resolveWorkflowContext(
    env,
    owner,
    admission.model,
    admission.childConversationId,
  )
  return admission
}
