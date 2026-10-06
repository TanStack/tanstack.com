import { workspaceHistorySchema } from '../core/workspace-history'
import { botDragLayout } from '../core/bot-drag'
import { moveBotGroup } from '../core/bot-group-move'
import { z } from 'zod'
import { db } from '~/db/client'
import { and, eq, sql } from 'drizzle-orm'
import {
  chatBots,
  chatConversations,
  chatConversationMains,
  chatBotViewerState,
  chatBotSections,
} from '~/db/schema'
import { botSchema } from '../core/types'
import { isPersonalAssistant, type WorkspaceBot } from '../core/bot-workspace'
import { readWorkspaceBot, readWorkspaceBots } from './bot-workspace-reads'
import { BotWorkspaceError } from './workspace-error'
import { WorkspaceSections } from './workspace-sections'
import {
  wakeWorkspaceSync,
  type WorkspaceSyncEnvironment,
} from './workspace-sync'
import {
  reserveWorkspaceConversations,
  type WorkspaceLifecycleEnvironment,
} from './workspace-lifecycle-reservation'
import {
  botPatchSchema,
  botOrganizationSchema,
  botMoveSchema,
  botGroupMoveSchema,
} from '../core/workspace-index'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Source BotWorkspace commands, using shared PostgreSQL storage and section commands. */
export class BotWorkspace extends WorkspaceSections {
  constructor(
    override readonly env: Pick<WorkspaceSyncEnvironment, 'WORKSPACE_SYNC'> &
      WorkspaceLifecycleEnvironment,
    workspaceId: string,
    userId: string,
  ) {
    super(env, workspaceId, userId)
  }
  async get(id: string) {
    return readWorkspaceBot(this.workspaceId, this.userId, id)
  }
  private checkVersion(bot: WorkspaceBot, expected: number) {
    if (bot.version !== expected)
      throw new BotWorkspaceError(
        'This conversation changed in another window. Refresh and try again.',
        409,
      )
  }
  private available(bot: WorkspaceBot) {
    if (bot.deleted_at !== null)
      throw new BotWorkspaceError(
        'Restore this conversation from Trash before changing it.',
        409,
      )
  }
  private async parent(id: string | null, botId?: string) {
    if (id === null) return
    let candidate = await this.get(id)
    if (candidate.deleted_at !== null || candidate.archived_at !== null)
      throw new BotWorkspaceError('Choose an active parent conversation.', 409)
    const visited = new Set<string>()
    while (candidate) {
      if (candidate.id === botId || visited.has(candidate.id))
        throw new BotWorkspaceError(
          'A conversation cannot be nested under itself or its children.',
          409,
        )
      visited.add(candidate.id)
      if (!candidate.parent_id) break
      candidate = await this.get(candidate.parent_id)
    }
  }

  private async authorizeWorkspace() {
    const rows = await db.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId}`,
    )
    if (!rows.length)
      throw new BotWorkspaceError('Workspace access is unavailable.', 403)
  }
  async create(input: unknown) {
    const value = botSchema.parse(input)
    await this.authorizeWorkspace()
    await this.parent(value.parentId)
    const id = crypto.randomUUID()
    const now = new Date()
    try {
      await db.transaction(async (tx) => {
        const members = await tx.execute(
          sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
        )
        if (!members.length)
          throw new BotWorkspaceError(
            'Access changed before the conversation could be created. Refresh and try again.',
            409,
          )
        await tx.insert(chatBots).values({
          id,
          workspaceId: this.workspaceId,
          parentId: value.parentId,
          name: value.name,
          purpose: value.purpose,
          createdAt: now,
          updatedAt: now,
        })
        const conversationId = `chat:${id}:${this.userId}`
        await tx.insert(chatConversations).values({
          id: conversationId,
          botId: id,
          userId: this.userId,
          createdAt: now,
        })
        await tx
          .insert(chatConversationMains)
          .values({ botId: id, userId: this.userId, conversationId })
      })
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes(
          'Parent bot is not available in this workspace.',
        ) ||
          (error.cause instanceof Error &&
            error.cause.message.includes(
              'Parent bot is not available in this workspace.',
            )))
      )
        throw new BotWorkspaceError(
          'The parent conversation is no longer available. Choose another.',
          409,
        )
      throw error
    }
    await wakeWorkspaceSync(this.env, this.workspaceId)
    await this.authorizeWorkspace()
    return { id, bot: await this.get(id) }
  }
  async patch(
    id: string,
    input: unknown,
    options?: { beforeCommit?: () => void | Promise<void> },
  ) {
    const value = botPatchSchema.parse(input)
    await this.authorizeWorkspace()
    const bot = await this.get(id)
    this.checkVersion(bot, value.version)
    this.available(bot)
    if (value.avatar !== undefined && !isPersonalAssistant(bot))
      throw new BotWorkspaceError(
        'Only your personal assistant can have an icon.',
        400,
      )
    if (value.archived === true && isPersonalAssistant(bot))
      throw new BotWorkspaceError(
        'Your personal assistant cannot be archived.',
        400,
      )
    if (value.parentId !== undefined) await this.parent(value.parentId, id)
    const reservation =
      value.archived === true
        ? await reserveWorkspaceConversations(this.env, this.workspaceId, [id])
        : {
            release: async () => {},
            expiresAt: Number.MAX_SAFE_INTEGER,
            botIds: [],
            conversationIds: [],
          }
    try {
      await options?.beforeCommit?.()
      await db.transaction(async (tx) => {
        const members = await tx.execute(
          sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
        )
        const current = await tx
          .select()
          .from(chatBots)
          .where(
            and(
              eq(chatBots.id, id),
              eq(chatBots.workspaceId, this.workspaceId),
            ),
          )
          .for('update')
        if (
          !members.length ||
          current.length !== 1 ||
          current[0].version !== value.version ||
          current[0].deletedAt !== null
        )
          throw new BotWorkspaceError(
            'This conversation changed in another window. Refresh and try again.',
            409,
          )
        if (reservation.botIds.length) {
          const rows = await tx.execute<
            { id: string } & Record<string, unknown>
          >(
            sql`SELECT id FROM chat_conversations WHERE bot_id=${id} ORDER BY id FOR SHARE`,
          )
          const expected = [...reservation.conversationIds].sort()
          if (
            rows.length !== expected.length ||
            rows.some((row, index) => row.id !== expected[index])
          )
            throw new BotWorkspaceError(
              'This conversation changed in another window. Refresh and try again.',
              409,
            )
        }
        await tx
          .update(chatBots)
          .set({
            ...(value.name === undefined ? {} : { name: value.name }),
            ...(value.purpose === undefined ? {} : { purpose: value.purpose }),
            ...(value.parentId === undefined
              ? {}
              : { parentId: value.parentId }),
            ...(value.avatar === undefined ? {} : { avatar: value.avatar }),
            archivedAt:
              value.archived === undefined
                ? current[0].archivedAt
                : value.archived
                  ? new Date()
                  : null,
            updatedAt: new Date(),
            version: value.version + 1,
          })
          .where(eq(chatBots.id, id))
        const [deadline] = await tx.execute<
          { valid: boolean } & Record<string, unknown>
        >(
          sql`SELECT extract(epoch FROM clock_timestamp())*1000 < ${reservation.expiresAt} AS valid`,
        )
        if (!deadline.valid)
          throw new BotWorkspaceError(
            'The lifecycle check expired. Try again.',
            409,
          )
      })
      await wakeWorkspaceSync(this.env, this.workspaceId)
      await this.authorizeWorkspace()
      return { bot: await this.get(id) }
    } catch (error) {
      const detail =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : ''
      if (detail.includes('A bot cannot be its own ancestor.'))
        throw new BotWorkspaceError(
          'A conversation cannot be nested under itself or its children.',
          409,
        )
      if (detail.includes('Parent bot is not available in this workspace.'))
        throw new BotWorkspaceError(
          'The parent conversation is no longer available. Choose another.',
          409,
        )
      throw error
    } finally {
      await reservation.release()
    }
  }
  async organize(
    id: string,
    input: unknown,
    options?: { beforeCommit?: () => void | Promise<void> },
  ) {
    const value = botOrganizationSchema.parse(input)
    await this.authorizeWorkspace()
    const bot = await this.get(id)
    this.available(bot)
    await options?.beforeCommit?.()
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['chat-section-order', this.workspaceId, this.userId])},0))`,
      )
      const members = await tx.execute(
        sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
      )
      const [current] = await tx
        .select()
        .from(chatBots)
        .where(
          and(eq(chatBots.id, id), eq(chatBots.workspaceId, this.workspaceId)),
        )
        .for('update')
      if (
        !members.length ||
        !current ||
        current.deletedAt !== null ||
        current.version !== bot.version
      )
        throw new BotWorkspaceError(
          'This conversation changed in another window. Refresh and try again.',
          409,
        )
      if (value.sectionId) {
        const sections = await tx.execute(
          sql`SELECT id FROM chat_bot_sections WHERE id=${value.sectionId} AND workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
        )
        if (!sections.length)
          throw new BotWorkspaceError('Section not found.', 404)
      }
      const fields = {
        ...(value.pinned === undefined ? {} : { pinned: value.pinned }),
        ...(value.sectionId === undefined
          ? {}
          : { sectionId: value.sectionId }),
        ...(value.position === undefined ? {} : { position: value.position }),
        ...(value.tags === undefined ? {} : { tags: [...new Set(value.tags)] }),
      }
      await tx
        .insert(chatBotViewerState)
        .values({ botId: id, userId: this.userId, ...fields })
        .onConflictDoUpdate({
          target: [chatBotViewerState.botId, chatBotViewerState.userId],
          set: fields,
        })
      const moved =
        (value.sectionId !== undefined && value.sectionId !== bot.section_id) ||
        (value.pinned !== undefined && value.pinned !== bot.pinned) ||
        value.position !== undefined
      if (moved) {
        await this.reorderBots(tx, bot, null, 0)
        await this.reorderBots(
          tx,
          {
            ...bot,
            section_id:
              value.sectionId === undefined ? bot.section_id : value.sectionId,
            pinned: value.pinned ?? bot.pinned,
          },
          id,
          value.position ?? 1e12,
        )
      }
      if (
        value.sectionId !== undefined &&
        value.sectionId !== bot.section_id &&
        bot.section_id !== null
      )
        await tx.execute(
          sql`DELETE FROM chat_bot_sections s WHERE s.id=${bot.section_id} AND s.workspace_id=${this.workspaceId} AND s.user_id=${this.userId} AND NOT EXISTS(SELECT 1 FROM chat_bot_viewer_state v WHERE v.section_id=s.id AND v.user_id=s.user_id)`,
        )
    })
    await wakeWorkspaceSync(this.env, this.workspaceId)
    await this.authorizeWorkspace()
    const updated = await this.get(id)
    this.available(updated)
    return { bot: updated }
  }
  private async reorderBots(
    tx: Transaction,
    group: WorkspaceBot,
    movingId: string | null,
    requestedPosition: number,
  ) {
    await tx.execute(sql`WITH peers AS (
      SELECT b.id,b.created_at,COALESCE(v.position,0) AS position FROM chat_bots b
      LEFT JOIN chat_bot_viewer_state v ON v.bot_id=b.id AND v.user_id=${this.userId}
      WHERE b.workspace_id=${this.workspaceId} AND b.parent_id IS NOT DISTINCT FROM ${group.parent_id}
      AND (${group.pinned} OR v.section_id IS NOT DISTINCT FROM ${group.section_id})
      AND COALESCE(v.pinned,false)=${group.pinned} AND (b.archived_at IS NOT NULL)=${group.archived_at !== null} AND b.deleted_at IS NULL
    ), ordered AS (
      SELECT id,row_number() OVER(ORDER BY position,created_at,id)-1 AS n FROM peers WHERE id IS DISTINCT FROM ${movingId}
    ), placement AS (SELECT least(greatest(${Math.trunc(requestedPosition)}::bigint,0),(SELECT count(*) FROM ordered)) AS n),
    positions AS (
      SELECT id,ordered.n+CASE WHEN ${movingId}::text IS NOT NULL AND ordered.n>=placement.n THEN 1 ELSE 0 END AS n FROM ordered CROSS JOIN placement
      UNION ALL SELECT id,(SELECT n FROM placement) FROM peers WHERE id=${movingId}
    ) INSERT INTO chat_bot_viewer_state(bot_id,user_id,position)
      SELECT id,${this.userId}::uuid,n FROM positions
      ON CONFLICT(bot_id,user_id) DO UPDATE SET position=excluded.position`)
  }
  private async subtree(id: string, tx: Transaction | typeof db = db) {
    return Array.from(
      await tx.execute<
        {
          id: string
          version: number
          deleted_at: number | null
          deletion_batch: string | null
        } & Record<string, unknown>
      >(sql`WITH RECURSIVE tree(id) AS (
      SELECT id FROM chat_bots WHERE id=${id} AND workspace_id=${this.workspaceId}
      UNION SELECT b.id FROM chat_bots b JOIN tree t ON b.parent_id=t.id WHERE b.workspace_id=${this.workspaceId}
    ) SELECT b.id,b.version::float8 AS version,trunc(extract(epoch FROM b.deleted_at)*1000)::float8 AS deleted_at,b.deletion_batch FROM tree t JOIN chat_bots b ON b.id=t.id ORDER BY b.id`),
    )
  }
  private async activeAncestor(
    id: string | null,
    tx: Transaction | typeof db = db,
  ) {
    const visited = new Set<string>()
    while (id) {
      if (visited.has(id)) return null
      visited.add(id)
      const [bot] = await tx
        .select()
        .from(chatBots)
        .where(
          and(eq(chatBots.id, id), eq(chatBots.workspaceId, this.workspaceId)),
        )
      if (!bot) throw new BotWorkspaceError('Conversation not found.', 404)
      if (bot.archivedAt === null && bot.deletedAt === null) return id
      id = bot.parentId
    }
    return null
  }
  private async lockSubtree(
    tx: Transaction,
    id: string,
    snapshot: Awaited<ReturnType<BotWorkspace['subtree']>>,
  ) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-hierarchy:' + this.workspaceId},0))`,
    )
    const member = await tx.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
    )
    await tx
      .select({ id: chatBots.id })
      .from(chatBots)
      .where(
        and(
          eq(chatBots.workspaceId, this.workspaceId),
          sql`${chatBots.id} IN(SELECT jsonb_array_elements_text(${JSON.stringify(snapshot.map((row) => row.id))}::jsonb))`,
        ),
      )
      .orderBy(chatBots.id)
      .for('update')
    const latest = await this.subtree(id, tx)
    if (!member.length || JSON.stringify(latest) !== JSON.stringify(snapshot))
      throw new BotWorkspaceError(
        'The conversation hierarchy changed. Refresh and try again.',
        409,
      )
  }
  async delete(id: string, input: unknown) {
    const value = z
      .object({
        version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        descendants: z.enum(['subtree', 'reparent']),
      })
      .strict()
      .parse(input)
    await this.authorizeWorkspace()
    const bot = await this.get(id)
    this.checkVersion(bot, value.version)
    this.available(bot)
    if (isPersonalAssistant(bot))
      throw new BotWorkspaceError(
        'Your personal assistant cannot be deleted.',
        400,
      )
    const snapshot = await this.subtree(id)
    if (snapshot.find((row) => row.id === id)?.version !== value.version)
      throw new BotWorkspaceError(
        'This conversation changed. Refresh and try again.',
        409,
      )
    const targets =
      value.descendants === 'subtree'
        ? snapshot.filter((row) => row.deleted_at === null)
        : [bot]
    const reservation = await reserveWorkspaceConversations(
      this.env,
      this.workspaceId,
      snapshot.filter((row) => row.deleted_at === null).map((row) => row.id),
    )
    try {
      await db.transaction(async (tx) => {
        await this.lockSubtree(tx, id, snapshot)
        const conversations = await tx.execute<
          { id: string } & Record<string, unknown>
        >(
          sql`SELECT id FROM chat_conversations WHERE bot_id IN(SELECT jsonb_array_elements_text(${JSON.stringify(reservation.botIds)}::jsonb)) ORDER BY id FOR SHARE`,
        )
        const expected = [...reservation.conversationIds].sort()
        if (
          conversations.length !== expected.length ||
          conversations.some((row, index) => row.id !== expected[index])
        )
          throw new BotWorkspaceError(
            'The conversation hierarchy changed. Refresh and try again.',
            409,
          )
        const now = new Date(),
          batch = crypto.randomUUID()
        if (value.descendants === 'reparent') {
          const parentId = await this.activeAncestor(bot.parent_id, tx)
          await tx.execute(
            sql`UPDATE chat_bots SET parent_id=${parentId},version=version+1,updated_at=${now.toISOString()} WHERE parent_id=${id} AND workspace_id=${this.workspaceId}`,
          )
        }
        await tx.execute(
          sql`UPDATE chat_bots SET version=version+1,updated_at=${now.toISOString()},deleted_at=${now.toISOString()},deletion_batch=${batch} WHERE id IN(SELECT jsonb_array_elements_text(${JSON.stringify(targets.map((row) => row.id))}::jsonb)) AND deleted_at IS NULL`,
        )
        const [deadline] = await tx.execute<
          { valid: boolean } & Record<string, unknown>
        >(
          sql`SELECT extract(epoch FROM clock_timestamp())*1000 < ${reservation.expiresAt} AS valid`,
        )
        if (!deadline.valid)
          throw new BotWorkspaceError(
            'The lifecycle check expired. Try again.',
            409,
          )
      })
      await wakeWorkspaceSync(this.env, this.workspaceId)
      await this.authorizeWorkspace()
      return {
        ok: true,
        bots: await readWorkspaceBots(this.workspaceId, this.userId),
      }
    } finally {
      await reservation.release()
    }
  }
  async restore(id: string, input: unknown) {
    const value = z
      .object({ version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })
      .strict()
      .parse(input)
    await this.authorizeWorkspace()
    const bot = await this.get(id)
    this.checkVersion(bot, value.version)
    if (bot.deleted_at === null)
      throw new BotWorkspaceError('This conversation is not in Trash.', 409)
    const snapshot = await this.subtree(id)
    const root = snapshot.find((row) => row.id === id)
    if (!root || root.version !== value.version)
      throw new BotWorkspaceError(
        'This conversation changed. Refresh and try again.',
        409,
      )
    const targets = snapshot.filter(
      (row) =>
        row.deleted_at !== null && row.deletion_batch === root.deletion_batch,
    )
    await db.transaction(async (tx) => {
      await this.lockSubtree(tx, id, snapshot)
      const parentId = await this.activeAncestor(bot.parent_id, tx)
      if (parentId !== bot.parent_id)
        await tx.update(chatBots).set({ parentId }).where(eq(chatBots.id, id))
      await tx.execute(
        sql`UPDATE chat_bots SET version=version+1,updated_at=${new Date().toISOString()},deleted_at=NULL,deletion_batch=NULL WHERE id IN(SELECT jsonb_array_elements_text(${JSON.stringify(targets.map((row) => row.id))}::jsonb))`,
      )
    })
    await wakeWorkspaceSync(this.env, this.workspaceId)
    await this.authorizeWorkspace()
    return {
      ok: true,
      bots: await readWorkspaceBots(this.workspaceId, this.userId),
    }
  }
  async move(id: string, input: unknown) {
    const { version, ...value } = botMoveSchema.parse(input)
    await this.moveGroup({ ...value, bots: [{ id, version }] })
    return { bot: await this.get(id) }
  }
  async moveGroup(input: unknown) {
    const value = botGroupMoveSchema.parse(input)
    await this.authorizeWorkspace()
    const current = await readWorkspaceBots(this.workspaceId, this.userId)
    if (
      value.bots.some(
        (selected) => !current.some((bot) => bot.id === selected.id),
      )
    )
      throw new BotWorkspaceError('Conversation not found.', 404)
    if (botDragLayout(current) !== value.layout)
      throw new BotWorkspaceError(
        'The conversation order changed. Refresh and try again.',
        409,
      )
    let projected: WorkspaceBot[]
    try {
      projected = moveBotGroup(current, value, Date.now())
    } catch (error) {
      throw new BotWorkspaceError(
        error instanceof Error
          ? error.message
          : 'The conversation could not be moved.',
        409,
      )
    }
    const roots = projected
      .filter((bot, index) => bot.version !== current[index].version)
      .sort((a, b) => a.position - b.position)
    const changed = projected.filter((bot, index) => {
      const before = current[index]
      return (
        bot.parent_id !== before.parent_id ||
        bot.section_id !== before.section_id ||
        bot.pinned !== before.pinned ||
        bot.position !== before.position ||
        bot.version !== before.version
      )
    })
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['chat-section-order', this.workspaceId, this.userId])},0))`,
      )
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-hierarchy:' + this.workspaceId},0))`,
      )
      const member = await tx.execute(
        sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
      )
      await tx
        .select({ id: chatBots.id })
        .from(chatBots)
        .where(eq(chatBots.workspaceId, this.workspaceId))
        .orderBy(chatBots.id)
        .for('update')
      if (
        !member.length ||
        botDragLayout(
          await readWorkspaceBots(this.workspaceId, this.userId, tx),
        ) !== value.layout
      )
        throw new BotWorkspaceError(
          'The conversation order changed. Refresh and try again.',
          409,
        )
      if (value.sectionId) {
        const sections = await tx.execute(
          sql`SELECT id FROM chat_bot_sections WHERE id=${value.sectionId} AND workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
        )
        if (!sections.length)
          throw new BotWorkspaceError('Section not found.', 404)
      }
      if (value.parentId) {
        const [parent] = await tx
          .select()
          .from(chatBots)
          .where(
            and(
              eq(chatBots.id, value.parentId),
              eq(chatBots.workspaceId, this.workspaceId),
            ),
          )
        if (!parent || parent.archivedAt !== null || parent.deletedAt !== null)
          throw new BotWorkspaceError(
            'Choose an active parent conversation.',
            409,
          )
      }
      const rootIds = JSON.stringify(roots.map((bot) => bot.id))
      await tx.execute(
        sql`UPDATE chat_bots SET parent_id=${value.parentId} WHERE workspace_id=${this.workspaceId} AND id IN(SELECT jsonb_array_elements_text(${rootIds}::jsonb))`,
      )
      if (changed.length)
        await tx
          .insert(chatBotViewerState)
          .values(
            changed.map(({ id, section_id, pinned, position }) => ({
              botId: id,
              userId: this.userId,
              sectionId: section_id,
              pinned,
              position,
            })),
          )
          .onConflictDoUpdate({
            target: [chatBotViewerState.botId, chatBotViewerState.userId],
            set: {
              sectionId: sql`excluded.section_id`,
              pinned: sql`excluded.pinned`,
              position: sql`excluded.position`,
            },
          })
      await tx.execute(
        sql`UPDATE chat_bots SET version=version+1,updated_at=${new Date().toISOString()} WHERE id IN(SELECT jsonb_array_elements_text(${rootIds}::jsonb))`,
      )
      const previousSections = current
        .filter((bot) =>
          changed.some(
            (next) => next.id === bot.id && next.section_id !== bot.section_id,
          ),
        )
        .map((bot) => bot.section_id)
        .filter((id) => id !== null)
      await tx.execute(
        sql`DELETE FROM chat_bot_sections s WHERE s.workspace_id=${this.workspaceId} AND s.user_id=${this.userId} AND s.id IN(SELECT jsonb_array_elements_text(${JSON.stringify(previousSections)}::jsonb)) AND NOT EXISTS(SELECT 1 FROM chat_bot_viewer_state v WHERE v.section_id=s.id AND v.user_id=s.user_id)`,
      )
    })
    await wakeWorkspaceSync(this.env, this.workspaceId)
    await this.authorizeWorkspace()
    return { movedIds: roots.map((bot) => bot.id) }
  }
  async applyHistory(input: unknown) {
    const change = workspaceHistorySchema.parse(input)
    await this.authorizeWorkspace()
    const current = await readWorkspaceBots(this.workspaceId, this.userId)
    const ids = new Set<string>()
    for (const { before, after } of change.bots) {
      if (before.id !== after.id || ids.has(before.id))
        throw new BotWorkspaceError('Invalid undo change.')
      ids.add(before.id)
      const bot = current.find((b) => b.id === before.id)
      if (!bot || bot.deleted_at !== null)
        throw new BotWorkspaceError(
          'This conversation is no longer available.',
          409,
        )
    }
    const targets = new Map(current.map((b) => [b.id, b.parent_id]))
    for (const { after } of change.bots) targets.set(after.id, after.parent_id)
    for (const { after } of change.bots) {
      const seen = new Set([after.id])
      let parent = after.parent_id
      while (parent) {
        if (seen.has(parent))
          throw new BotWorkspaceError(
            'A conversation cannot be nested under itself.',
            409,
          )
        seen.add(parent)
        const p = current.find((b) => b.id === parent)
        if (!p || p.deleted_at !== null)
          throw new BotWorkspaceError(
            'The parent conversation is unavailable.',
            409,
          )
        parent = targets.get(parent) ?? null
      }
    }
    const sectionIds = new Set<string>()
    for (const { before, after } of change.sections) {
      const id = before?.id ?? after?.id
      if (
        !id ||
        (before && after && before.id !== after.id) ||
        sectionIds.has(id)
      )
        throw new BotWorkspaceError('Invalid section change.')
      sectionIds.add(id)
    }
    for (const { after } of change.bots) {
      const bot = current.find((candidate) => candidate.id === after.id)
      if (after.archived && bot && isPersonalAssistant(bot))
        throw new BotWorkspaceError(
          'Your personal assistant cannot be archived.',
          400,
        )
    }
    const archiving = change.bots
      .filter((c) => c.after.archived && !c.before.archived)
      .map((c) => c.after.id)
    const reservation = archiving.length
      ? await reserveWorkspaceConversations(
          this.env,
          this.workspaceId,
          archiving,
        )
      : {
          release: async () => {},
          expiresAt: Number.MAX_SAFE_INTEGER,
          botIds: [],
          conversationIds: [],
        }

    try {
      await db.transaction(async (tx) => {
        const conflict = () =>
          new BotWorkspaceError(
            'This change cannot be undone because the affected chats or sections changed elsewhere.',
            409,
          )
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['chat-section-order', this.workspaceId, this.userId])},0))`,
        )
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-hierarchy:' + this.workspaceId},0))`,
        )
        const member = await tx.execute(
          sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.workspaceId} AND user_id=${this.userId} FOR SHARE`,
        )
        if (!member.length) throw conflict()
        await tx
          .select({ id: chatBots.id })
          .from(chatBots)
          .where(eq(chatBots.workspaceId, this.workspaceId))
          .orderBy(chatBots.id)
          .for('update')
        const latest = await readWorkspaceBots(
          this.workspaceId,
          this.userId,
          tx,
        )
        for (const { before } of change.bots) {
          const bot = latest.find((bot) => bot.id === before.id)
          if (
            !bot ||
            bot.deleted_at !== null ||
            bot.parent_id !== before.parent_id ||
            bot.section_id !== before.section_id ||
            bot.pinned !== before.pinned ||
            bot.position !== before.position ||
            (bot.archived_at !== null) !== before.archived
          )
            throw conflict()
        }
        const sectionRows = await tx
          .select()
          .from(chatBotSections)
          .where(
            and(
              eq(chatBotSections.workspaceId, this.workspaceId),
              eq(chatBotSections.userId, this.userId),
            ),
          )
          .for('update')
        for (const { before, after } of change.sections) {
          if (before) {
            const section = sectionRows.find((row) => row.id === before.id)
            if (
              !section ||
              section.name !== before.name ||
              section.position !== before.position ||
              section.sortOverride !== before.sort_override
            )
              throw conflict()
          } else if (after) {
            const collision = await tx
              .select({ id: chatBotSections.id })
              .from(chatBotSections)
              .where(eq(chatBotSections.id, after.id))
            if (collision.length) throw conflict()
          }
          if (!after && before) {
            const outsiders = await tx.execute(
              sql`SELECT 1 FROM chat_bot_viewer_state WHERE section_id=${before.id} AND bot_id NOT IN(SELECT jsonb_array_elements_text(${JSON.stringify([...ids])}::jsonb)) LIMIT 1`,
            )
            if (outsiders.length) throw conflict()
          }
        }
        for (const { after } of change.bots)
          if (
            after.section_id &&
            !change.sections.some(
              (section) => section.after?.id === after.section_id,
            ) &&
            !sectionRows.some((section) => section.id === after.section_id)
          )
            throw conflict()
        const conversations = await tx.execute<
          { id: string } & Record<string, unknown>
        >(
          sql`SELECT id FROM chat_conversations WHERE bot_id IN(SELECT jsonb_array_elements_text(${JSON.stringify(reservation.botIds)}::jsonb)) ORDER BY id FOR SHARE`,
        )
        const expected = [...reservation.conversationIds].sort()
        if (
          conversations.length !== expected.length ||
          conversations.some((row, index) => row.id !== expected[index])
        )
          throw conflict()
        for (const { after } of change.sections)
          if (after)
            await tx
              .insert(chatBotSections)
              .values({
                id: after.id,
                workspaceId: this.workspaceId,
                userId: this.userId,
                name: after.name,
                position: after.position,
                sortOverride: after.sort_override,
                version: 0,
              })
              .onConflictDoUpdate({
                target: chatBotSections.id,
                set: {
                  name: after.name,
                  position: after.position,
                  sortOverride: after.sort_override,
                  version: sql`${chatBotSections.version}+1`,
                },
              })
        for (const { before, after } of change.bots)
          if (before.parent_id !== after.parent_id)
            await tx
              .update(chatBots)
              .set({ parentId: null })
              .where(eq(chatBots.id, after.id))
        for (const { before, after } of change.bots) {
          if (before.parent_id !== after.parent_id)
            await tx
              .update(chatBots)
              .set({ parentId: after.parent_id })
              .where(eq(chatBots.id, after.id))
          await tx
            .insert(chatBotViewerState)
            .values({
              botId: after.id,
              userId: this.userId,
              sectionId: after.section_id,
              pinned: after.pinned,
              position: after.position,
            })
            .onConflictDoUpdate({
              target: [chatBotViewerState.botId, chatBotViewerState.userId],
              set: {
                sectionId: after.section_id,
                pinned: after.pinned,
                position: after.position,
              },
            })
          await tx
            .update(chatBots)
            .set({
              version: sql`${chatBots.version}+1`,
              updatedAt: new Date(),
              archivedAt: after.archived
                ? sql`COALESCE(${chatBots.archivedAt},now())`
                : null,
            })
            .where(eq(chatBots.id, after.id))
        }
        for (const { before, after } of change.sections)
          if (!after && before)
            await tx
              .delete(chatBotSections)
              .where(
                and(
                  eq(chatBotSections.id, before.id),
                  eq(chatBotSections.workspaceId, this.workspaceId),
                  eq(chatBotSections.userId, this.userId),
                ),
              )
        const [deadline] = await tx.execute<
          { valid: boolean } & Record<string, unknown>
        >(
          sql`SELECT extract(epoch FROM clock_timestamp())*1000 < ${reservation.expiresAt} AS valid`,
        )
        if (!deadline.valid) throw conflict()
      })
      await wakeWorkspaceSync(this.env, this.workspaceId)
      await this.authorizeWorkspace()
      return { ok: true }
    } finally {
      await reservation.release()
    }
  }
}
