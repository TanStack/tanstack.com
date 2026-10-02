import { db } from '~/db/client'
import { and, eq, sql } from 'drizzle-orm'
import { chatRecipes, chatWorkspaces, chatMemberships } from '~/db/schema'
import { recipeSchema, policySchema, type Recipe } from '../core/types'
import { WorkspacePolicyError } from '../workspace-policy.server'

/** Source recipes API and runtime reads, using shared account membership and PostgreSQL. */
export class SavedActions {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
  async list(forRun = false) {
    const member = await db.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}`,
    )
    if (!member.length) throw new WorkspacePolicyError()
    return Array.from(
      await db.execute<
        Recipe & Record<string, unknown>
      >(sql`SELECT r.id,r.workspace_id,r.title,r.description,r.code,r.created_at::float8 AS created_at
      FROM chat_recipes r JOIN chat_memberships m ON m.workspace_id=r.workspace_id
      WHERE r.workspace_id=${this.workspaceId} AND m.user_id=${this.userId}
      ORDER BY r.created_at ${forRun ? sql`LIMIT 30` : sql``}`),
    )
  }
  async create(input: unknown) {
    const value = recipeSchema.parse(input),
      id = crypto.randomUUID()
    await db.transaction(async (tx) => {
      const [workspace] = await tx
        .select({ policy: chatWorkspaces.policy })
        .from(chatWorkspaces)
        .innerJoin(
          chatMemberships,
          and(
            eq(chatMemberships.workspaceId, chatWorkspaces.id),
            eq(chatMemberships.userId, this.userId),
          ),
        )
        .where(eq(chatWorkspaces.id, this.workspaceId))
        .for('share')
      if (!workspace) throw new WorkspacePolicyError()
      if (!policySchema.parse(workspace.policy).allowKody)
        throw new Error('Saved Kody actions are disabled by policy.')
      await tx.insert(chatRecipes).values({
        id,
        workspaceId: this.workspaceId,
        ...value,
        createdAt: Date.now(),
      })
    })
    return { id }
  }
  async delete(id: string) {
    await db.transaction(async (tx) => {
      const member = await tx.execute(
        sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
      )
      if (!member.length) throw new WorkspacePolicyError()
      await tx
        .delete(chatRecipes)
        .where(
          and(
            eq(chatRecipes.id, id),
            eq(chatRecipes.workspaceId, this.workspaceId),
          ),
        )
    })
    return { ok: true }
  }
}
