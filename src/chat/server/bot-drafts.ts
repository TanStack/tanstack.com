import { z } from 'zod'
import { and, eq, isNull, inArray } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatMemberships,
  chatBots,
  chatConversations,
  chatConversationMains,
  chatBotDrafts,
  chatFileDrafts,
  chatSavedFiles,
} from '~/db/schema'
import {
  botDraftInput,
  draftBotName,
  type BotDraftReceipt,
} from '../core/bot-draft'
import {
  runModelSchema,
  sameRunModel,
  type RunModelSelection,
} from '../core/run-model'
import { referenceInputsSchema } from '../core/message-references'
import { promoteDraftFiles } from './draft-files'
import { SavedFileError, type FileEnvironment } from './saved-files'
export class BotDraftError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
  }
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Row = typeof chatBotDrafts.$inferSelect
/** Persistence half of source BotDrafts.start. Runtime preparation must validate references/model attachments before reservation. */
export class BotDrafts {
  constructor(
    private env: FileEnvironment,
    private workspaceId: string,
    private userId: string,
  ) {}
  private async member(tx?: Transaction) {
    const query = (tx ?? db)
      .select({ id: chatMemberships.userId })
      .from(chatMemberships)
      .where(
        and(
          eq(chatMemberships.workspaceId, this.workspaceId),
          eq(chatMemberships.userId, this.userId),
        ),
      )
    const [member] = await (tx ? query.for('update') : query)
    if (!member) throw new BotDraftError('Workspace not found.', 403)
  }
  private where(id: string) {
    return and(
      eq(chatBotDrafts.workspaceId, this.workspaceId),
      eq(chatBotDrafts.userId, this.userId),
      eq(chatBotDrafts.id, id),
    )
  }
  private async row(id: string, tx?: Transaction) {
    z.string().uuid().parse(id)
    const [row] = await (tx ?? db)
      .select()
      .from(chatBotDrafts)
      .where(this.where(id))
    return row
  }
  private receipt(row: Row): BotDraftReceipt {
    return {
      botId: row.botId,
      conversationId: row.conversationId,
      parentId: row.parentId,
      text: row.text,
      started: row.startedAt !== null,
      fileIds: row.fileIds,
      ...(row.referenceInputs.length
        ? { references: referenceInputsSchema.parse(row.referenceInputs) }
        : {}),
      ...(row.runModel ? { runModel: runModelSchema.parse(row.runModel) } : {}),
    }
  }
  async get(id: string) {
    await this.member()
    const row = await this.row(id)
    await this.member()
    return row ? this.receipt(row) : null
  }
  async markStarted(id: string) {
    await db.transaction(async (tx) => {
      await this.member(tx)
      const row = await this.row(id, tx)
      if (!row) throw new BotDraftError('Draft not found.', 404)
      await tx
        .update(chatBotDrafts)
        .set({ startedAt: Date.now() })
        .where(this.where(id))
    })
    const receipt = await this.get(id)
    if (!receipt) throw new BotDraftError('Draft not found.', 404)
    return receipt
  }
  async reserve(
    id: string,
    input: unknown,
    prepare: (
      value: z.infer<typeof botDraftInput>,
    ) => Promise<RunModelSelection>,
  ) {
    await this.member()
    z.string().uuid().parse(id)
    const value = botDraftInput.parse(input)
    const assertMatch = (row: Row) => {
      if (
        row.text !== value.text ||
        row.parentId !== value.parentId ||
        JSON.stringify(row.fileIds) !== JSON.stringify(value.fileIds) ||
        JSON.stringify(row.referenceInputs) !==
          JSON.stringify(value.references) ||
        (value.runModel &&
          row.runModel &&
          !sameRunModel(value.runModel, row.runModel))
      )
        throw new BotDraftError(
          'This draft already has a first message. Retry that message or start a new conversation.',
        )
    }
    let row = await this.row(id)
    if (!row) {
      const selection = runModelSchema.parse(await prepare(value))
      if (value.runModel && !sameRunModel(value.runModel, selection))
        throw new BotDraftError(
          'This draft already has a different model selection. Retry the original message.',
        )
      row = await db.transaction(async (tx) => {
        await this.member(tx)
        const winner = await this.row(id, tx)
        if (winner) {
          assertMatch(winner)
          return winner
        }
        if (value.parentId) {
          const [parent] = await tx
            .select({ id: chatBots.id })
            .from(chatBots)
            .where(
              and(
                eq(chatBots.id, value.parentId),
                eq(chatBots.workspaceId, this.workspaceId),
                isNull(chatBots.archivedAt),
                isNull(chatBots.deletedAt),
              ),
            )
            .for('update')
          if (!parent)
            throw new BotDraftError(
              'The parent is unavailable or access changed. Choose an active conversation and try again.',
            )
        }
        if (value.fileIds.length) {
          const selected = await tx
            .select({ state: chatSavedFiles.state })
            .from(chatSavedFiles)
            .where(
              and(
                eq(chatSavedFiles.workspaceId, this.workspaceId),
                eq(chatSavedFiles.userId, this.userId),
                eq(chatSavedFiles.draftId, id),
                inArray(chatSavedFiles.id, value.fileIds),
              ),
            )
            .for('update')
          if (selected.length !== value.fileIds.length)
            throw new SavedFileError('File not found.', 404)
          if (selected.some((file) => file.state !== 'ready'))
            throw new SavedFileError(
              'Finish uploading each attachment before sending.',
              409,
            )
        }
        const botId = crypto.randomUUID()
        const conversationId = `chat:${botId}:${this.userId}`
        await tx
          .insert(chatFileDrafts)
          .values({
            workspaceId: this.workspaceId,
            userId: this.userId,
            id,
            createdAt: Date.now(),
          })
          .onConflictDoNothing()
        await tx.insert(chatBots).values({
          id: botId,
          workspaceId: this.workspaceId,
          parentId: value.parentId,
          name: draftBotName(value.text),
          purpose: '',
        })
        await tx
          .insert(chatConversations)
          .values({ id: conversationId, botId, userId: this.userId })
        await tx
          .insert(chatConversationMains)
          .values({ conversationId, botId, userId: this.userId })
        const [created] = await tx
          .insert(chatBotDrafts)
          .values({
            workspaceId: this.workspaceId,
            userId: this.userId,
            id,
            botId,
            conversationId,
            parentId: value.parentId,
            text: value.text,
            fileIds: value.fileIds,
            runModel: selection,
            referenceInputs: value.references,
            createdAt: Date.now(),
          })
          .returning()
        await promoteDraftFiles(
          tx,
          { workspaceId: this.workspaceId, userId: this.userId, draftId: id },
          botId,
          conversationId,
        )
        return created
      })
    }
    assertMatch(row)
    await this.member()
    return this.receipt(row)
  }
}
