import type { BotActivity } from '../core/bot-views'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import {
  readWorkspacePolicy,
  WorkspacePolicyError,
} from '../workspace-policy.server'
import { readWorkspaceBots, readBotSections } from './bot-workspace-reads'
import { readBotActivity } from './bot-activity'
import { SavedActions } from './saved-actions'

/** Original bootstrap workspace reads, using shared membership and PostgreSQL.
 * Account onboarding, credentials and spending are composed by the HTTP caller. */
export async function readBootstrapWorkspaceData(
  workspaceId: string,
  userId: string,
) {
  const policy = await readWorkspacePolicy(workspaceId, userId)
  const [workspace] = await db.execute<
    { id: string; name: string } & Record<string, unknown>
  >(
    sql`SELECT w.id,w.name FROM chat_workspaces w JOIN chat_memberships m ON m.workspace_id=w.id WHERE w.id=${workspaceId} AND m.user_id=${userId}`,
  )
  if (!workspace) throw new WorkspacePolicyError()
  const [bots, sections, activity, recipes, workspaces] = await Promise.all([
    readWorkspaceBots(workspaceId, userId),
    readBotSections(workspaceId, userId),
    workspaceActivity(workspaceId, userId),
    new SavedActions(workspaceId, userId).list(),
    db.execute<{ id: string; name: string } & Record<string, unknown>>(
      sql`SELECT w.id,w.name FROM chat_workspaces w JOIN chat_memberships m ON m.workspace_id=w.id WHERE m.user_id=${userId} ORDER BY w.name,w.id`,
    ),
  ])
  return {
    workspace,
    policy,
    bots,
    sections,
    activity,
    recipes,
    workspaces: Array.from(workspaces),
  }
}

export async function workspaceActivity(
  workspaceId: string,
  userId: string,
): Promise<Record<string, BotActivity>> {
  const summaries = await readBotActivity(workspaceId, userId)
  return Object.fromEntries(
    Object.entries(summaries).map(([id, s]) => [
      id,
      {
        status: s.status,
        activity_at: s.activityAt,
        event_version: s.eventVersion,
        read_version: s.readVersion,
        preview: s.preview,
        message_count: s.messageCount,
        queued_count: s.queuedCount,
        queue_paused: s.queuePaused,
      },
    ]),
  )
}
