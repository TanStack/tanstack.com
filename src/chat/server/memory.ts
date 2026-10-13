import { z } from 'zod'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatBots,
  chatConversations,
  chatConversationThreads,
  chatMemberships,
  chatMemories,
  chatMemoryCommands,
  chatMemoryPreferences,
} from '~/db/schema'
import { memoryCommandSchema, memoryListSchema } from '../core/memory'
import { hash } from './crypto'

export class MemoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
export interface MemoryScope {
  workspaceId: string
  userId: string
  conversationId: string
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Private conversation evidence. Scope and provenance come from authenticated runtime state. */
export class Memories {
  constructor(
    private scope: MemoryScope,
    private now = () => Date.now(),
  ) {}
  private scoped() {
    return and(
      eq(chatMemories.conversationId, this.scope.conversationId),
      eq(chatMemories.workspaceId, this.scope.workspaceId),
      eq(chatMemories.userId, this.scope.userId),
    )
  }
  private async authorize(write = false, tx?: Transaction) {
    const query = (tx ?? db)
      .select({ id: chatBots.id, archivedAt: chatBots.archivedAt })
      .from(chatConversations)
      .innerJoin(chatBots, eq(chatBots.id, chatConversations.botId))
      .innerJoin(
        chatMemberships,
        and(
          eq(chatMemberships.workspaceId, chatBots.workspaceId),
          eq(chatMemberships.userId, this.scope.userId),
        ),
      )
      .where(
        and(
          eq(chatConversations.id, this.scope.conversationId),
          eq(chatConversations.userId, this.scope.userId),
          eq(chatBots.workspaceId, this.scope.workspaceId),
          isNull(chatBots.deletedAt),
        ),
      )
    const [row] = await (tx
      ? query.for('update', {
          of: [chatBots, chatConversations, chatMemberships],
        })
      : query)
    if (!row || (write && row.archivedAt))
      throw new MemoryError('Conversation access is unavailable.', 403)
    if (write) {
      const threadQuery = (tx ?? db)
        .select({ archivedAt: chatConversationThreads.archivedAt })
        .from(chatConversationThreads)
        .where(
          eq(chatConversationThreads.conversationId, this.scope.conversationId),
        )
      const [thread] = await (tx ? threadQuery.for('update') : threadQuery)
      if (thread?.archivedAt)
        throw new MemoryError('Conversation access is unavailable.', 403)
    }
  }
  async preferences() {
    const [row] = await db
      .select({
        enabled: chatMemoryPreferences.enabled,
        revision: chatMemoryPreferences.revision,
      })
      .from(chatConversations)
      .innerJoin(chatBots, eq(chatBots.id, chatConversations.botId))
      .innerJoin(
        chatMemberships,
        and(
          eq(chatMemberships.workspaceId, chatBots.workspaceId),
          eq(chatMemberships.userId, this.scope.userId),
        ),
      )
      .leftJoin(
        chatMemoryPreferences,
        eq(chatMemoryPreferences.conversationId, chatConversations.id),
      )
      .where(
        and(
          eq(chatConversations.id, this.scope.conversationId),
          eq(chatConversations.userId, this.scope.userId),
          eq(chatBots.workspaceId, this.scope.workspaceId),
          isNull(chatBots.deletedAt),
        ),
      )
    if (!row) throw new MemoryError('Conversation access is unavailable.', 403)
    return { enabled: row.enabled === true, revision: row.revision ?? 0 }
  }
  async setPreferences(input: unknown) {
    const value = z
      .strictObject({
        enabled: z.boolean(),
        expectedRevision: z.number().int().nonnegative().safe(),
      })
      .parse(input)
    await db.transaction(async (tx) => {
      await this.authorize(true, tx)
      const [current] = await tx
        .select()
        .from(chatMemoryPreferences)
        .where(
          eq(chatMemoryPreferences.conversationId, this.scope.conversationId),
        )
      if (
        (current?.revision ?? 0) !== value.expectedRevision ||
        value.expectedRevision >= Number.MAX_SAFE_INTEGER
      )
        throw new MemoryError(
          'Memory recall changed. Reload before editing.',
          409,
        )
      await tx
        .insert(chatMemoryPreferences)
        .values({
          conversationId: this.scope.conversationId,
          enabled: value.enabled,
          revision: value.expectedRevision + 1,
          updatedAt: this.now(),
        })
        .onConflictDoUpdate({
          target: chatMemoryPreferences.conversationId,
          set: {
            enabled: value.enabled,
            revision: value.expectedRevision + 1,
            updatedAt: this.now(),
          },
        })
    })
    return this.preferences()
  }
  private view(row: typeof chatMemories.$inferSelect) {
    return {
      id: row.id,
      revision: row.revision,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
      sourceMessageId: row.sourceMessageId,
      sourceRunId: row.sourceRunId,
    }
  }
  async read(id: string) {
    z.string().uuid().parse(id)
    await this.authorize()
    const [row] = await db
      .select()
      .from(chatMemories)
      .where(and(this.scoped(), eq(chatMemories.id, id)))
    await this.authorize()
    if (!row || (row.expiresAt !== null && row.expiresAt <= this.now()))
      throw new MemoryError('Memory not found.', 404)
    return this.view(row)
  }
  async list(input: unknown = {}) {
    const options = memoryListSchema.parse(input)
    await this.authorize()
    const rows = await db
      .select()
      .from(chatMemories)
      .where(
        and(
          this.scoped(),
          options.afterId ? gt(chatMemories.id, options.afterId) : undefined,
          or(
            isNull(chatMemories.expiresAt),
            gt(chatMemories.expiresAt, this.now()),
          ),
          sql`(strpos(lower(${chatMemories.title}),lower(${options.query}))>0 OR strpos(lower(${chatMemories.body}),lower(${options.query}))>0)`,
        ),
      )
      .orderBy(chatMemories.id)
      .limit(options.limit + 1)
    await this.authorize()
    const page = rows.slice(0, options.limit)
    return {
      items: page
        .filter((row) => row.expiresAt === null || row.expiresAt > this.now())
        .map((row) => this.view(row)),
      ...(rows.length > options.limit ? { nextAfterId: page.at(-1)!.id } : {}),
    }
  }
  async command(
    input: unknown,
    options: {
      beforeCommit?: () => void
      sourceMessageId?: string
      sourceRunId?: string
    } = {},
  ) {
    const command = memoryCommandSchema.parse(input)
    const digest = await hash(
      JSON.stringify({
        command,
        sourceMessageId: options.sourceMessageId ?? null,
        sourceRunId: options.sourceRunId ?? null,
      }),
    )
    const receipt = await db.transaction(async (tx) => {
      await this.authorize(false, tx)
      const [previous] = await tx
        .select()
        .from(chatMemoryCommands)
        .where(
          and(
            eq(chatMemoryCommands.conversationId, this.scope.conversationId),
            eq(chatMemoryCommands.commandId, command.commandId),
          ),
        )
      if (previous) {
        if (previous.requestHash !== digest)
          throw new MemoryError(
            'This command ID was used for another change.',
            409,
          )
        return previous
      }
      await this.authorize(true, tx)
      const now = this.now()
      if (
        command.type !== 'delete' &&
        command.document.expiresAt !== null &&
        command.document.expiresAt <= now
      )
        throw new MemoryError('Choose an expiry in the future.')
      const [current] = await tx
        .select()
        .from(chatMemories)
        .where(and(this.scoped(), eq(chatMemories.id, command.id)))
      const [used] = await tx
        .select({ id: chatMemoryCommands.memoryId })
        .from(chatMemoryCommands)
        .where(
          and(
            eq(chatMemoryCommands.conversationId, this.scope.conversationId),
            eq(chatMemoryCommands.memoryId, command.id),
          ),
        )
        .limit(1)
      if (
        command.type === 'create'
          ? current || used
          : !current || current.revision !== command.expectedRevision
      )
        throw new MemoryError(
          'Memory changed or is unavailable. Reload before editing.',
          409,
        )
      const revision =
        command.type === 'create' ? 1 : command.expectedRevision + 1
      if (!Number.isSafeInteger(revision))
        throw new MemoryError(
          'Memory changed or is unavailable. Reload before editing.',
          409,
        )
      options.beforeCommit?.()
      if (command.type === 'create')
        await tx.insert(chatMemories).values({
          id: command.id,
          ...this.scope,
          revision,
          ...command.document,
          createdAt: now,
          updatedAt: now,
          sourceMessageId: options.sourceMessageId ?? null,
          sourceRunId: options.sourceRunId ?? null,
        })
      else if (command.type === 'update')
        await tx
          .update(chatMemories)
          .set({ ...command.document, revision, updatedAt: now })
          .where(and(this.scoped(), eq(chatMemories.id, command.id)))
      else
        await tx
          .delete(chatMemories)
          .where(and(this.scoped(), eq(chatMemories.id, command.id)))
      const [saved] = await tx
        .insert(chatMemoryCommands)
        .values({
          conversationId: this.scope.conversationId,
          commandId: command.commandId,
          requestHash: digest,
          memoryId: command.id,
          revision,
          operation: command.type,
          completedAt: now,
        })
        .returning()
      return saved
    })
    await this.authorize()
    return {
      id: receipt.memoryId,
      revision: receipt.revision,
      operation: receipt.operation,
      completedAt: receipt.completedAt,
    }
  }
}
