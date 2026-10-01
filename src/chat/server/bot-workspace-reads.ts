import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { BotWorkspaceError } from './workspace-error'
import type { BotSection, WorkspaceBot } from '../core/bot-workspace'

type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

type Row = Omit<WorkspaceBot, 'mainConversationId'> & {
  mainConversationId: string | null
}

/** Ported from bot-workspace.ts. Callers authorize workspace membership before these internal reads. */
export async function readWorkspaceBots(
  workspaceId: string,
  userId: string,
  reader: Reader = db,
) {
  return readBots(workspaceId, userId, undefined, reader)
}

/** Original BotWorkspace.get, retaining exact workspace scope and missing-row error. */
export async function readWorkspaceBot(
  workspaceId: string,
  userId: string,
  id: string,
) {
  const [bot] = await readBots(workspaceId, userId, id)
  if (!bot) throw new BotWorkspaceError('Conversation not found.', 404)
  return bot
}

async function readBots(
  workspaceId: string,
  userId: string,
  id?: string,
  reader: Reader = db,
) {
  const rows = await reader.execute<Row & Record<string, unknown>>(sql`
    SELECT b.id,b.workspace_id,b.parent_id,b.name,b.purpose,b.avatar,
      trunc(extract(epoch FROM b.created_at)*1000)::float8 AS created_at,
      b.version::float8 AS version,
      trunc(extract(epoch FROM b.archived_at)*1000)::float8 AS archived_at,
      trunc(extract(epoch FROM b.deleted_at)*1000)::float8 AS deleted_at,
      trunc(extract(epoch FROM b.updated_at)*1000)::float8 AS updated_at,
      main.conversation_id AS "mainConversationId",COALESCE(v.pinned,false) AS pinned,
      v.section_id,COALESCE(v.position,0) AS position,COALESCE(v.tags,'[]'::jsonb) AS tags
    FROM chat_bots b
    LEFT JOIN chat_bot_viewer_state v ON v.bot_id=b.id AND v.user_id=${userId}
    LEFT JOIN chat_conversation_mains main ON main.bot_id=b.id AND main.user_id=${userId}
    WHERE b.workspace_id=${workspaceId}
      ${id === undefined ? sql`` : sql`AND b.id=${id}`}
      ORDER BY b.created_at,b.id`)
  return rows.map(
    ({ mainConversationId, ...row }): WorkspaceBot => ({
      ...row,
      ...(mainConversationId === null ? {} : { mainConversationId }),
      pinned: Boolean(row.pinned),
      tags: z.array(z.string()).parse(row.tags),
    }),
  )
}

export async function readBotSections(
  workspaceId: string,
  userId: string,
  page?: { query?: string; afterId?: string },
): Promise<BotSection[]> {
  const columns = sql`id,name,position,version::float8 AS version,sort_override`
  if (page) {
    return Array.from(
      await db.execute<
        BotSection & Record<string, unknown>
      >(sql`SELECT ${columns}
      FROM chat_bot_sections WHERE workspace_id=${workspaceId} AND user_id=${userId}
      AND id>${page.afterId ?? ''} AND strpos(lower(name),lower(${page.query ?? ''}))>0
      ORDER BY id LIMIT 101`),
    )
  }
  return Array.from(
    await db.execute<BotSection & Record<string, unknown>>(sql`SELECT ${columns}
    FROM chat_bot_sections WHERE workspace_id=${workspaceId} AND user_id=${userId}
    ORDER BY position,id`),
  )
}
