import type { SqlStorage } from '@cloudflare/workers-types'
import { db } from '~/db/client'
import { sql as pg } from 'drizzle-orm'
import type {
  ActivityProjection,
  BotActivitySummary,
} from '../core/bot-activity'
interface ActivityRow extends Record<string, unknown> {
  conversation_id: string
  bot_id: string
  user_id: string
  status: BotActivitySummary['status']
  activity_at: number
  event_version: number
  read_version: number
  preview: string
  message_count: number
  queued_count: number
  queue_paused: boolean
}
export async function readBotActivity(
  workspaceId: string,
  userId: string,
): Promise<Record<string, BotActivitySummary>> {
  const rows = await db.execute<ActivityRow>(
    pg`SELECT a.*,a.activity_at::double precision AS activity_at,a.event_version::double precision AS event_version,a.read_version::double precision AS read_version,a.message_count::double precision AS message_count,a.queued_count::double precision AS queued_count FROM chat_conversation_activity a JOIN chat_conversations c ON c.id=a.conversation_id AND c.bot_id=a.bot_id AND c.user_id=a.user_id JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE b.workspace_id=${workspaceId} AND c.user_id=${userId} AND EXISTS(SELECT 1 FROM chat_conversation_mains main WHERE main.conversation_id=c.id AND main.bot_id=c.bot_id AND main.user_id=c.user_id)`,
  )
  return Object.fromEntries(
    rows.map((r) => [
      r.bot_id,
      {
        conversationId: r.conversation_id,
        botId: r.bot_id,
        userId: r.user_id,
        status: r.status,
        activityAt: r.activity_at,
        eventVersion: r.event_version,
        readVersion: r.read_version,
        preview: r.preview,
        messageCount: r.message_count,
        queuedCount: r.queued_count,
        queuePaused: !!r.queue_paused,
      },
    ]),
  )
}
export async function markBotRead(
  workspaceId: string,
  userId: string,
  botId: string,
  version: number,
): Promise<void> {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error('Invalid activity version.')
  await db.execute(
    pg`UPDATE chat_conversation_activity SET read_version=GREATEST(read_version,LEAST(event_version,${version})) WHERE conversation_id IN (SELECT c.id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.bot_id=${botId} AND c.user_id=${userId} AND b.workspace_id=${workspaceId} AND EXISTS(SELECT 1 FROM chat_conversation_mains main WHERE main.conversation_id=c.id AND main.bot_id=c.bot_id AND main.user_id=c.user_id)) AND bot_id=${botId} AND user_id=${userId}`,
  )
}
export async function markConversationRead(
  workspaceId: string,
  userId: string,
  conversationId: string,
  version: number,
): Promise<void> {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error('Invalid activity version.')
  await db.execute(
    pg`UPDATE chat_conversation_activity SET read_version=GREATEST(read_version,LEAST(event_version,${version})) WHERE conversation_id=${conversationId} AND EXISTS(SELECT 1 FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=chat_conversation_activity.conversation_id AND c.bot_id=chat_conversation_activity.bot_id AND c.user_id=chat_conversation_activity.user_id AND c.user_id=${userId} AND b.workspace_id=${workspaceId})`,
  )
}
/** Original read acknowledgement query, scoped to the authenticated owner and workspace. */
export async function readConversationReadVersion(
  workspaceId: string,
  userId: string,
  conversationId: string,
) {
  const [seen] = await db.execute<
    { read_version: number } & Record<string, unknown>
  >(
    pg`SELECT a.read_version::float8 AS read_version FROM chat_conversation_activity a JOIN chat_conversations c ON c.id=a.conversation_id AND c.bot_id=a.bot_id AND c.user_id=a.user_id JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${conversationId} AND c.user_id=${userId} AND b.workspace_id=${workspaceId}`,
  )
  return seen?.read_version ?? 0
}
/** One persisted latest-value outbox. Conditional updates reject stale deliveries. */
export class BotActivityOutbox {
  private flushing?: Promise<void>
  constructor(private sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS activity_outbox (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, json TEXT NOT NULL)',
    )
  }
  enqueue(projection: ActivityProjection) {
    this.sql.exec(
      'INSERT INTO activity_outbox VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,json=excluded.json',
      projection.summary.eventVersion,
      JSON.stringify(projection),
    )
  }
  async flush(): Promise<void> {
    do {
      if (!this.flushing)
        this.flushing = this.drain().finally(() => {
          this.flushing = undefined
        })
      await this.flushing
    } while (
      this.sql.exec('SELECT version FROM activity_outbox LIMIT 1').toArray()
        .length
    )
  }
  private async drain() {
    while (true) {
      const row = this.sql
        .exec<{ version: number; json: string }>(
          'SELECT version,json FROM activity_outbox WHERE id=1',
        )
        .toArray()[0]
      if (!row) return
      const { identity, summary: s }: ActivityProjection = JSON.parse(row.json)
      await db.execute(pg`INSERT INTO chat_conversation_activity(conversation_id,bot_id,user_id,status,activity_at,event_version,read_version,preview,message_count,queued_count,queue_paused)
       SELECT c.id,c.bot_id,c.user_id,${s.status},${s.activityAt},${s.eventVersion},0,${s.preview},${s.messageCount},${s.queuedCount ?? 0},${s.queuePaused ?? false} FROM chat_conversations c
       JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id
       WHERE c.bot_id=${identity.botId} AND b.workspace_id=${identity.workspaceId} AND c.user_id=${identity.userId} AND
       ((${identity.conversationId ?? null}::text IS NOT NULL AND c.id=${identity.conversationId ?? null}) OR (${identity.conversationId ?? null}::text IS NULL AND EXISTS(SELECT 1 FROM chat_conversation_mains main WHERE main.conversation_id=c.id AND main.bot_id=c.bot_id AND main.user_id=c.user_id)))
       ON CONFLICT(conversation_id) DO UPDATE SET status=excluded.status,activity_at=excluded.activity_at,event_version=excluded.event_version,preview=excluded.preview,message_count=excluded.message_count,queued_count=excluded.queued_count,queue_paused=excluded.queue_paused WHERE excluded.event_version>chat_conversation_activity.event_version AND chat_conversation_activity.bot_id=excluded.bot_id AND chat_conversation_activity.user_id=excluded.user_id`)
      this.sql.exec(
        'DELETE FROM activity_outbox WHERE id=1 AND version=?',
        row.version,
      )
    }
  }
}
