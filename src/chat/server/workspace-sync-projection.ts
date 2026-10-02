import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/db/client'
import {
  chatBots,
  chatBotViewerState,
  chatBotSections,
  chatConversationMains,
  chatConversations,
  chatConversationActivity,
  chatMemberships,
  chatWorkspaceSyncClock,
  chatWorkspaceSyncMembers,
} from '~/db/schema'
import type { WorkspaceProjection } from '../core/workspace-sync'

export async function syncMembership(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ generation: chatWorkspaceSyncMembers.generation })
    .from(chatWorkspaceSyncMembers)
    .innerJoin(
      chatMemberships,
      and(
        eq(chatMemberships.workspaceId, chatWorkspaceSyncMembers.workspaceId),
        eq(chatMemberships.userId, chatWorkspaceSyncMembers.userId),
      ),
    )
    .where(
      and(
        eq(chatWorkspaceSyncMembers.workspaceId, workspaceId),
        eq(chatWorkspaceSyncMembers.userId, userId),
      ),
    )
  return member
}

/** Ported from workspace-sync.ts. State and its watermark share one database snapshot. */
export async function readSyncProjection(workspaceId: string, userId: string) {
  return db.transaction(
    async (tx) => {
      const [scope] = await tx
        .select({
          generation: chatWorkspaceSyncMembers.generation,
          revision: chatWorkspaceSyncClock.revision,
        })
        .from(chatWorkspaceSyncMembers)
        .innerJoin(
          chatMemberships,
          and(
            eq(
              chatMemberships.workspaceId,
              chatWorkspaceSyncMembers.workspaceId,
            ),
            eq(chatMemberships.userId, chatWorkspaceSyncMembers.userId),
          ),
        )
        .innerJoin(
          chatWorkspaceSyncClock,
          eq(
            chatWorkspaceSyncClock.workspaceId,
            chatWorkspaceSyncMembers.workspaceId,
          ),
        )
        .where(
          and(
            eq(chatWorkspaceSyncMembers.workspaceId, workspaceId),
            eq(chatWorkspaceSyncMembers.userId, userId),
          ),
        )
      if (!scope) return undefined
      const bots = await tx
        .select({
          bot: chatBots,
          viewer: chatBotViewerState,
          mainConversationId: chatConversationMains.conversationId,
        })
        .from(chatBots)
        .leftJoin(
          chatBotViewerState,
          and(
            eq(chatBotViewerState.botId, chatBots.id),
            eq(chatBotViewerState.userId, userId),
          ),
        )
        .leftJoin(
          chatConversationMains,
          and(
            eq(chatConversationMains.botId, chatBots.id),
            eq(chatConversationMains.userId, userId),
          ),
        )
        .where(eq(chatBots.workspaceId, workspaceId))
        .orderBy(asc(chatBots.createdAt), asc(chatBots.id))
      const sections = await tx
        .select()
        .from(chatBotSections)
        .where(
          and(
            eq(chatBotSections.workspaceId, workspaceId),
            eq(chatBotSections.userId, userId),
          ),
        )
        .orderBy(asc(chatBotSections.position), asc(chatBotSections.id))
      const activity = await tx
        .select({ row: chatConversationActivity })
        .from(chatConversationActivity)
        .innerJoin(
          chatConversations,
          and(
            eq(chatConversations.id, chatConversationActivity.conversationId),
            eq(chatConversations.botId, chatConversationActivity.botId),
            eq(chatConversations.userId, chatConversationActivity.userId),
          ),
        )
        .innerJoin(chatBots, eq(chatBots.id, chatConversations.botId))
        .innerJoin(
          chatConversationMains,
          and(
            eq(chatConversationMains.conversationId, chatConversations.id),
            eq(chatConversationMains.botId, chatConversations.botId),
            eq(chatConversationMains.userId, chatConversations.userId),
          ),
        )
        .where(
          and(
            eq(chatBots.workspaceId, workspaceId),
            eq(chatConversations.userId, userId),
          ),
        )
      const state: WorkspaceProjection = {
        workspaceId,
        userId,
        bots: bots.map(({ bot, viewer, mainConversationId }) => ({
          id: bot.id,
          workspace_id: bot.workspaceId,
          parent_id: bot.parentId,
          name: bot.name,
          purpose: bot.purpose,
          created_at: bot.createdAt.getTime(),
          avatar: bot.avatar,
          version: bot.version,
          archived_at: bot.archivedAt?.getTime() ?? null,
          deleted_at: bot.deletedAt?.getTime() ?? null,
          updated_at: bot.updatedAt.getTime(),
          ...(mainConversationId ? { mainConversationId } : {}),
          pinned: viewer?.pinned ?? false,
          section_id: viewer?.sectionId ?? null,
          position: viewer?.position ?? 0,
          tags: viewer?.tags ?? [],
        })),
        sections: sections.map((row) => ({
          id: row.id,
          name: row.name,
          position: row.position,
          version: row.version,
          sort_override: z
            .enum(['position', 'name', 'created', 'activity', 'unread'])
            .nullable()
            .parse(row.sortOverride),
        })),
        activity: Object.fromEntries(
          activity.map(({ row }) => [
            row.botId,
            {
              status: z
                .enum([
                  'idle',
                  'running',
                  'approval',
                  'setup',
                  'error',
                  'completed',
                ])
                .parse(row.status),
              activity_at: row.activityAt,
              event_version: row.eventVersion,
              read_version: row.readVersion,
              preview: row.preview,
              message_count: row.messageCount,
              queued_count: row.queuedCount,
              queue_paused: row.queuePaused,
            },
          ]),
        ),
      }
      return { ...scope, state }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
