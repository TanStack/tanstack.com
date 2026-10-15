import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { canonicalCopyJson } from '../core/conversation-copy'
import {
  botSectionSchema,
  botSectionPatchSchema,
  botSectionAssignmentsSchema,
} from '../core/workspace-index'
import { BotWorkspaceError } from './workspace-error'
import { readBotSections, readWorkspaceBots } from './bot-workspace-reads'
import {
  wakeWorkspaceSync,
  type WorkspaceSyncEnvironment,
} from './workspace-sync'
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Section commands ported from BotWorkspace, with PostgreSQL transactions replacing D1 batch guards. */
export class WorkspaceSections {
  constructor(
    readonly env: Pick<WorkspaceSyncEnvironment, 'WORKSPACE_SYNC'>,
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
  private async authorize(tx: Transaction | typeof db = db, lock = false) {
    const rows = await tx.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} ${lock ? sql`FOR SHARE` : sql``}`,
    )
    if (!rows.length) throw new BotWorkspaceError('Workspace not found.', 404)
  }
  private async lock(tx: Transaction) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalCopyJson(['chat-section-order', this.workspaceId, this.userId])},0))`,
    )
    await this.authorize(tx, true)
  }
  async createSection(
    input: unknown,
    options?: { beforeCommit?: () => void | Promise<void> },
  ) {
    const { name } = botSectionSchema.parse(input)
    await this.authorize()
    const id = crypto.randomUUID()
    await options?.beforeCommit?.()
    await db.transaction(async (tx) => {
      await this.lock(tx)
      await tx.execute(
        sql`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) SELECT ${id},${this.workspaceId},${this.userId},${name},COALESCE((SELECT max(position)+1 FROM chat_bot_sections WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}),0)`,
      )
    })
    await this.authorize()
    await wakeWorkspaceSync(this.env, this.workspaceId)
    return {
      id,
      sections: await readBotSections(this.workspaceId, this.userId),
    }
  }
  async setSections(
    input: unknown,
    options?: { beforeCommit?: () => void | Promise<void> },
  ) {
    const assignments = botSectionAssignmentsSchema.parse(input)
    await this.authorize()
    const current = await readWorkspaceBots(this.workspaceId, this.userId)
    const byId = new Map(current.map((bot) => [bot.id, bot]))
    const sectionIds = new Set(
      (await readBotSections(this.workspaceId, this.userId)).map(
        (section) => section.id,
      ),
    )
    const expected = assignments.map((assignment) => {
      const bot = byId.get(assignment.id)
      if (!bot) throw new BotWorkspaceError('Conversation not found.', 404)
      if (bot.deleted_at !== null)
        throw new BotWorkspaceError(
          'Restore this conversation from Trash before changing it.',
          409,
        )
      if (assignment.sectionId && !sectionIds.has(assignment.sectionId))
        throw new BotWorkspaceError('Section not found.', 404)
      return {
        ...assignment,
        version: bot.version,
        previousSectionId: bot.section_id,
      }
    })
    const json = JSON.stringify(expected)
    await options?.beforeCommit?.()
    await db.transaction(async (tx) => {
      await this.lock(tx)
      await tx.execute(
        sql`SELECT b.id FROM chat_bots b JOIN jsonb_array_elements(${json}::jsonb) e ON b.id=e->>'id' WHERE b.workspace_id=${this.workspaceId} ORDER BY b.id FOR UPDATE OF b`,
      )
      await tx.execute(
        sql`SELECT v.bot_id FROM chat_bot_viewer_state v JOIN jsonb_array_elements(${json}::jsonb) e ON v.bot_id=e->>'id' WHERE v.user_id=${this.userId} ORDER BY v.bot_id FOR UPDATE OF v`,
      )
      const targets = await tx.execute(
        sql`SELECT s.id FROM chat_bot_sections s JOIN jsonb_array_elements(${json}::jsonb) e ON s.id=e->>'sectionId' WHERE s.workspace_id=${this.workspaceId} AND s.user_id=${this.userId} ORDER BY s.id FOR SHARE OF s`,
      )
      const selected = new Set(
        expected.flatMap((item) => (item.sectionId ? [item.sectionId] : [])),
      )
      if (new Set(targets.map((row) => row.id)).size !== selected.size)
        throw new BotWorkspaceError(
          'This conversation changed in another window. Refresh and try again.',
          409,
        )
      const [checked] = await tx.execute<
        { count: number } & Record<string, unknown>
      >(
        sql`SELECT count(*)::integer AS count FROM jsonb_array_elements(${json}::jsonb) e JOIN chat_bots b ON b.id=e->>'id' AND b.workspace_id=${this.workspaceId} LEFT JOIN chat_bot_viewer_state v ON v.bot_id=b.id AND v.user_id=${this.userId} WHERE b.deleted_at IS NULL AND b.version=(e->>'version')::bigint AND v.section_id IS NOT DISTINCT FROM e->>'previousSectionId'`,
      )
      if (checked.count !== expected.length)
        throw new BotWorkspaceError(
          'This conversation changed in another window. Refresh and try again.',
          409,
        )
      await tx.execute(
        sql`INSERT INTO chat_bot_viewer_state(bot_id,user_id,section_id) SELECT e->>'id',${this.userId}::uuid,e->>'sectionId' FROM jsonb_array_elements(${json}::jsonb) e ON CONFLICT(bot_id,user_id) DO UPDATE SET section_id=excluded.section_id`,
      )
      const previous = JSON.stringify(
        expected.flatMap((item) =>
          item.previousSectionId ? [item.previousSectionId] : [],
        ),
      )
      await tx.execute(
        sql`DELETE FROM chat_bot_sections s WHERE s.workspace_id=${this.workspaceId} AND s.user_id=${this.userId} AND s.id IN(SELECT jsonb_array_elements_text(${previous}::jsonb)) AND NOT EXISTS(SELECT 1 FROM chat_bot_viewer_state v WHERE v.section_id=s.id AND v.user_id=s.user_id)`,
      )
    })
    await this.authorize()
    await wakeWorkspaceSync(this.env, this.workspaceId)
    const observed = new Map(
      (await readWorkspaceBots(this.workspaceId, this.userId)).map((bot) => [
        bot.id,
        bot,
      ]),
    )
    return assignments.map((assignment) => ({
      id: assignment.id,
      sectionId: observed.get(assignment.id)?.section_id,
      ok: observed.get(assignment.id)?.section_id === assignment.sectionId,
    }))
  }
  async patchSection(
    id: string,
    input: unknown,
    options?: { beforeCommit?: () => void | Promise<void> },
  ) {
    const value = botSectionPatchSchema.parse(input)
    await this.authorize()
    await options?.beforeCommit?.()
    await db.transaction(async (tx) => {
      await this.lock(tx)
      const [section] = await tx.execute<
        {
          name: string
          sort_override: string | null
          version: number
        } & Record<string, unknown>
      >(
        sql`SELECT name,sort_override,version::float8 AS version FROM chat_bot_sections WHERE id=${id} AND workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR UPDATE`,
      )
      if (!section) throw new BotWorkspaceError('Section not found.', 404)
      if (section.version !== value.version)
        throw new BotWorkspaceError(
          'This section changed. Refresh and try again.',
          409,
        )
      if (value.position !== undefined) {
        await tx.execute(
          sql`WITH ordered AS (SELECT id,row_number() OVER(ORDER BY position,id)-1 AS n FROM chat_bot_sections WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} AND id<>${id}),placement AS(SELECT least(greatest(${Math.trunc(value.position)}::bigint,0),(SELECT count(*) FROM ordered)) AS n),positions AS(SELECT ordered.id,ordered.n+CASE WHEN ordered.n>=placement.n THEN 1 ELSE 0 END AS n FROM ordered CROSS JOIN placement UNION ALL SELECT ${id}::text,(SELECT n FROM placement)) UPDATE chat_bot_sections SET position=positions.n,version=version+1 FROM positions WHERE chat_bot_sections.id=positions.id`,
        )
      }
      await tx.execute(
        sql`UPDATE chat_bot_sections SET name=${value.name ?? section.name},sort_override=${value.sortOverride === undefined ? section.sort_override : value.sortOverride},version=version+${value.position === undefined ? 1 : 0} WHERE id=${id}`,
      )
    })
    await this.authorize()
    await wakeWorkspaceSync(this.env, this.workspaceId)
    return { sections: await readBotSections(this.workspaceId, this.userId) }
  }
  async deleteSection(id: string) {
    await this.authorize()
    await db.transaction(async (tx) => {
      await this.lock(tx)
      const removed = await tx.execute(
        sql`DELETE FROM chat_bot_sections WHERE id=${id} AND workspace_id=${this.workspaceId} AND user_id=${this.userId} RETURNING id`,
      )
      if (!removed.length)
        throw new BotWorkspaceError('Section not found.', 404)
    })
    await this.authorize()
    await wakeWorkspaceSync(this.env, this.workspaceId)
    return { ok: true }
  }
}
