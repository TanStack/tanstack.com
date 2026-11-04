import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatMemberships, chatWorkspaces } from '~/db/schema'
import { policySchema } from './core/types'
export class WorkspacePolicyError extends Error {
  readonly status = 403
  constructor(message = 'Workspace access is unavailable.') {
    super(message)
  }
}
/** Read policy only through the authenticated account's membership. */
export async function readWorkspacePolicy(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ policy: chatWorkspaces.policy })
    .from(chatWorkspaces)
    .innerJoin(
      chatMemberships,
      eq(chatMemberships.workspaceId, chatWorkspaces.id),
    )
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatMemberships.userId, userId),
      ),
    )
  if (!row) throw new WorkspacePolicyError()
  return policySchema.parse(row.policy)
}

/** Original owner-only policy update, with ownership repeated in the write predicate. */
export async function updateWorkspacePolicy(
  workspaceId: string,
  userId: string,
  input: unknown,
) {
  const [owner] = await db
    .select({ id: chatWorkspaces.id })
    .from(chatWorkspaces)
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatWorkspaces.ownerId, userId),
      ),
    )
  if (!owner)
    throw new WorkspacePolicyError(
      'Only the workspace owner can change policy.',
    )
  const policy = policySchema.parse(input)
  const updated = await db
    .update(chatWorkspaces)
    .set({ policy })
    .where(
      and(
        eq(chatWorkspaces.id, workspaceId),
        eq(chatWorkspaces.ownerId, userId),
      ),
    )
    .returning({ id: chatWorkspaces.id })
  if (!updated.length)
    throw new WorkspacePolicyError(
      'Only the workspace owner can change policy.',
    )
  return { ok: true }
}
