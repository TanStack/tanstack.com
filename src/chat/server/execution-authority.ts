import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { conversationRunIdentitySchema } from '../core/conversation-runs'
type ConversationIdentity = z.infer<typeof conversationRunIdentitySchema>

export class ExecutionAuthorityError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message)
    this.name = 'ExecutionAuthorityError'
  }
}

export type ExecutionAuthority = {
  lifecycleGeneration: number
  membershipGeneration: number
}

type AuthorityRow = Record<string, unknown> &
  ExecutionAuthority & {
    archived_at: Date | null
    deleted_at: Date | null
    copy_status: string | null
    copy_workspace_id: string | null
    copy_user_id: string | null
    copy_bot_id: string | null
  }

/** Read before the DO transaction, then compare both generations and the local
 * lease fence inside it. Local copy activation remains guarded by the DO. */
export async function readExecutionAuthority(
  identity: ConversationIdentity,
  options: { allowInactive?: boolean } = {},
): Promise<ExecutionAuthority> {
  const { conversationId, botId, userId, workspaceId } = identity
  if (
    [conversationId, botId, userId, workspaceId].some(
      (value) =>
        typeof value !== 'string' || !value.length || value.length > 1000,
    )
  )
    throw new ExecutionAuthorityError('Conversation not found.', 404)
  // Authority and its epochs come from one database snapshot. A session ID or
  // same-bot sibling never substitutes for the exact authenticated conversation.
  const [row] =
    await db.execute<AuthorityRow>(sql`SELECT b.archived_at,b.deleted_at,
    COALESCE(lifecycle.generation,0)::double precision AS "lifecycleGeneration",
    COALESCE(membership_generation.generation,0)::double precision AS "membershipGeneration",
    copy.status AS copy_status,copy.workspace_id AS copy_workspace_id,copy.user_id AS copy_user_id,copy.target_bot_id AS copy_bot_id
    FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id
    JOIN chat_memberships membership ON membership.workspace_id=b.workspace_id AND membership.user_id=c.user_id
    LEFT JOIN chat_bot_schedule_suspensions lifecycle ON lifecycle.bot_id=b.id
    LEFT JOIN chat_execution_membership_generations membership_generation ON membership_generation.workspace_id=b.workspace_id AND membership_generation.user_id=c.user_id
    LEFT JOIN chat_conversation_copies copy ON copy.target_conversation_id=c.id
    WHERE c.id=${conversationId} AND c.bot_id=${botId} AND c.user_id=${userId} AND b.workspace_id=${workspaceId}`)
  if (!row) throw new ExecutionAuthorityError('Conversation not found.', 404)
  if (
    row.copy_status !== null &&
    (row.copy_status !== 'ready' ||
      row.copy_workspace_id !== workspaceId ||
      row.copy_user_id !== userId ||
      row.copy_bot_id !== botId)
  )
    throw new ExecutionAuthorityError(
      'This conversation copy is not ready yet.',
      409,
    )
  if (
    !options.allowInactive &&
    (row.archived_at !== null || row.deleted_at !== null)
  )
    throw new ExecutionAuthorityError(
      'Restore this conversation before continuing.',
      409,
    )
  const authority = {
    lifecycleGeneration: row.lifecycleGeneration,
    membershipGeneration: row.membershipGeneration,
  }
  if (
    Object.values(authority).some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new ExecutionAuthorityError(
      'Execution access is unavailable. Try again.',
      409,
    )
  return authority
}
