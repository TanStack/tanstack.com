import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatMemberships,
  chatFileDrafts,
  chatBotDrafts,
  chatSavedFiles,
} from '~/db/schema'
import {
  maxConversationFileBytes,
  maxConversationFiles,
  type DraftFile,
  type DraftFileScope,
} from '../core/files'
import { parseAttachmentFileIds } from '../core/message-attachments'
import {
  FileStore,
  SavedFileError,
  type FileEnvironment,
  type FileRow,
} from './saved-files'
export const maxUnsentFileDrafts = 20
export const maxDraftFiles = maxConversationFiles
export const maxDraftFileBytes = maxConversationFileBytes
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
function record(row: FileRow): DraftFile {
  if (!row.draft_id || row.bot_id !== null || row.conversation_id !== null)
    throw new SavedFileError('Draft file not found.', 404)
  return {
    id: row.id,
    draftId: row.draft_id,
    name: row.name,
    mediaType: row.media_type,
    size: row.size,
    sha256: row.sha256,
    source: row.source,
    state: row.state,
    createdAt: row.created_at,
  }
}
export class DraftFiles extends FileStore<DraftFile> {
  constructor(env: FileEnvironment, scope: DraftFileScope) {
    z.string().uuid().parse(scope.draftId)
    const draftWhere = and(
      eq(chatFileDrafts.workspaceId, scope.workspaceId),
      eq(chatFileDrafts.userId, scope.userId),
      eq(chatFileDrafts.id, scope.draftId),
    )
    const receiptWhere = and(
      eq(chatBotDrafts.workspaceId, scope.workspaceId),
      eq(chatBotDrafts.userId, scope.userId),
      eq(chatBotDrafts.id, scope.draftId),
    )
    const authorization = async (
      write: boolean,
      tx?: Transaction,
    ): Promise<void> => {
      if (write && !tx)
        return db.transaction((current) => authorization(write, current))
      const memberQuery = (tx ?? db)
        .select({ id: chatMemberships.userId })
        .from(chatMemberships)
        .where(
          and(
            eq(chatMemberships.workspaceId, scope.workspaceId),
            eq(chatMemberships.userId, scope.userId),
          ),
        )
      const [member] = await (tx ? memberQuery.for('update') : memberQuery)
      if (!member) throw new SavedFileError('Draft access is unavailable.', 403)
      const [sent] = await (tx ?? db)
        .select({ id: chatBotDrafts.id })
        .from(chatBotDrafts)
        .where(receiptWhere)
      if (sent)
        throw new SavedFileError(
          'This draft was sent. Open its conversation to use these files.',
          409,
        )
      if (!write || !tx) return
      const [existing] = await tx
        .select({ id: chatFileDrafts.id })
        .from(chatFileDrafts)
        .where(draftWhere)
      if (existing) return
      const [quota] = await tx
        .select({ count: sql<number>`count(*)::integer` })
        .from(chatFileDrafts)
        .where(
          sql`${chatFileDrafts.workspaceId}=${scope.workspaceId} AND ${chatFileDrafts.userId}=${scope.userId} AND NOT EXISTS (SELECT 1 FROM ${chatBotDrafts} b WHERE b.workspace_id=${chatFileDrafts.workspaceId} AND b.user_id=${chatFileDrafts.userId} AND b.id=${chatFileDrafts.id})`,
        )
      if (quota.count >= maxUnsentFileDrafts)
        throw new SavedFileError(
          'The workspace has reached the limit of 20 unsent drafts with files.',
          409,
        )
      await tx
        .insert(chatFileDrafts)
        .values({
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          id: scope.draftId,
          createdAt: Date.now(),
        })
        .onConflictDoNothing()
    }
    super(env, {
      values: () => ({
        workspaceId: scope.workspaceId,
        userId: scope.userId,
        draftId: scope.draftId,
      }),
      where: () =>
        sql`${chatSavedFiles.workspaceId}=${scope.workspaceId} AND ${chatSavedFiles.userId}=${scope.userId} AND ${chatSavedFiles.draftId}=${scope.draftId}`,
      maxFiles: maxDraftFiles,
      maxBytes: maxDraftFileBytes,
      limitMessage:
        'This file ID is unavailable or the draft file limit has been reached (100 files, 50 MiB).',
      record,
      authorize: authorization,
    })
  }
}
export async function resolveDraftAttachments(
  env: FileEnvironment,
  scope: DraftFileScope,
  fileIds: unknown,
): Promise<DraftFile[]> {
  const ids = parseAttachmentFileIds(fileIds)
  const files = new DraftFiles(env, scope)
  return Promise.all(
    ids.map(async (id) => {
      const file = await files.get(id)
      if (file.state !== 'ready')
        throw new SavedFileError(
          'Finish uploading each attachment before sending.',
          409,
        )
      return file
    }),
  )
}
/** Call after the matching first-send receipt is inserted in the same transaction. */
export async function promoteDraftFiles(
  tx: Transaction,
  scope: DraftFileScope,
  botId: string,
  conversationId?: string,
) {
  z.string().uuid().parse(scope.draftId)
  z.string().min(1).max(200).parse(botId)
  const [receipt] = await tx
    .select()
    .from(chatBotDrafts)
    .where(
      and(
        eq(chatBotDrafts.workspaceId, scope.workspaceId),
        eq(chatBotDrafts.userId, scope.userId),
        eq(chatBotDrafts.id, scope.draftId),
        eq(chatBotDrafts.botId, botId),
        conversationId
          ? eq(chatBotDrafts.conversationId, conversationId)
          : undefined,
      ),
    )
  if (!receipt) return
  await tx
    .update(chatSavedFiles)
    .set({ botId, conversationId: receipt.conversationId, draftId: null })
    .where(
      and(
        eq(chatSavedFiles.workspaceId, scope.workspaceId),
        eq(chatSavedFiles.userId, scope.userId),
        eq(chatSavedFiles.draftId, scope.draftId),
      ),
    )
}
