import { and, eq, sql, desc, asc, lt, gt, or } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatSkills,
  chatSkillVersions,
  chatSkillCommands,
  chatMemberships,
} from '~/db/schema'
import { z } from 'zod'
import {
  skillCommandSchema,
  skillDocumentSchema,
  skillSummarySchema,
  skillVersionSchema,
  type SkillSummary,
  type SkillVersion,
} from '../core/skills'
import { hash } from './crypto'

export interface SkillScope {
  workspaceId: string
  userId: string
}
export class SkillError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'SkillError'
  }
}
type Row = {
  id: string
  workspace_id: string
  user_id: string
  version: number
  revision: number
  enabled: number
  archived: number
  created_at: number
  updated_at: number
  document: string
}
const uuid = z.string().uuid()
const skillSelectionSchema = z
  .object({ skillId: uuid, version: z.number().int().positive().safe() })
  .strict()
const listInput = z
  .object({
    query: z.string().trim().max(200).default(''),
    archived: z.boolean().default(false),
    enabled: z.boolean().optional(),
    cursor: z.string().max(4000).optional(),
    limit: z.number().int().min(1).max(50).default(50),
  })
  .strict()
const cursorSchema = z
  .object({
    updatedAt: z.number().int().nonnegative(),
    id: uuid,
    query: z.string(),
    archived: z.boolean(),
    enabled: z.boolean().optional(),
  })
  .strict()
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
function summary(row: Row): SkillSummary {
  const document = JSON.parse(row.document)
  return skillSummarySchema.parse({
    id: row.id,
    name: document.name,
    description: document.description,
    version: row.version,
    revision: row.revision,
    enabled: !!row.enabled,
    archived: !!row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
const rowProjection = {
  id: chatSkills.id,
  workspace_id: chatSkills.workspaceId,
  user_id: chatSkills.userId,
  version: chatSkills.version,
  revision: chatSkills.revision,
  enabled: sql<number>`CASE WHEN ${chatSkills.enabled} THEN 1 ELSE 0 END`,
  archived: sql<number>`CASE WHEN ${chatSkills.archived} THEN 1 ELSE 0 END`,
  created_at: chatSkills.createdAt,
  updated_at: chatSkills.updatedAt,
  document: sql<string>`${chatSkillVersions.document}::text`,
}
export class Skills {
  constructor(private scope: SkillScope) {}
  private scoped() {
    return and(
      eq(chatSkills.workspaceId, this.scope.workspaceId),
      eq(chatSkills.userId, this.scope.userId),
    )
  }
  private async member(tx?: Transaction) {
    const query = (tx ?? db)
      .select({ id: chatMemberships.userId })
      .from(chatMemberships)
      .where(
        and(
          eq(chatMemberships.workspaceId, this.scope.workspaceId),
          eq(chatMemberships.userId, this.scope.userId),
        ),
      )
    const [member] = await (tx ? query.for('update') : query)
    if (!member) throw new SkillError('Workspace access is unavailable.', 403)
  }
  private async row(id: string, tx?: Transaction) {
    uuid.parse(id)
    const query = (tx ?? db)
      .select(rowProjection)
      .from(chatSkills)
      .innerJoin(
        chatSkillVersions,
        and(
          eq(chatSkillVersions.skillId, chatSkills.id),
          eq(chatSkillVersions.version, chatSkills.version),
        ),
      )
      .where(and(this.scoped(), eq(chatSkills.id, id)))
    const [row] = await (tx ? query.for('update', { of: [chatSkills] }) : query)
    return row
  }
  async list(
    input: unknown = {},
  ): Promise<{ items: SkillSummary[]; nextCursor?: string }> {
    const options = listInput.parse(input)
    await this.member()
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (options.cursor) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(decodeURIComponent(atob(options.cursor))),
        )
      } catch {
        throw new SkillError('The skill list cursor is invalid.')
      }
      if (
        cursor.query !== options.query ||
        cursor.archived !== options.archived ||
        cursor.enabled !== options.enabled
      )
        throw new SkillError(
          'Restart this skill list after changing its filters.',
        )
    }
    const rows = await db
      .select({
        ...rowProjection,
        document: sql<string>`jsonb_build_object('name',${chatSkillVersions.document}->>'name','description',${chatSkillVersions.document}->>'description')::text`,
      })
      .from(chatSkills)
      .innerJoin(
        chatSkillVersions,
        and(
          eq(chatSkillVersions.skillId, chatSkills.id),
          eq(chatSkillVersions.version, chatSkills.version),
        ),
      )
      .where(
        and(
          this.scoped(),
          eq(chatSkills.archived, options.archived),
          options.enabled === undefined
            ? undefined
            : eq(chatSkills.enabled, options.enabled),
          sql`(strpos(lower(${chatSkillVersions.document}->>'name'),lower(${options.query}))>0 OR strpos(lower(${chatSkillVersions.document}->>'description'),lower(${options.query}))>0)`,
          cursor
            ? or(
                lt(chatSkills.updatedAt, cursor.updatedAt),
                and(
                  eq(chatSkills.updatedAt, cursor.updatedAt),
                  gt(chatSkills.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(chatSkills.updatedAt), asc(chatSkills.id))
      .limit(options.limit + 1)
    await this.member()
    const page = rows.slice(0, options.limit),
      last = page.at(-1)
    return {
      items: page.map(summary),
      ...(rows.length > options.limit && last
        ? {
            nextCursor: btoa(
              encodeURIComponent(
                JSON.stringify({
                  updatedAt: last.updated_at,
                  id: last.id,
                  query: options.query,
                  archived: options.archived,
                  ...(options.enabled === undefined
                    ? {}
                    : { enabled: options.enabled }),
                }),
              ),
            ),
          }
        : {}),
    }
  }

  async inspect(id: string, version?: number): Promise<SkillVersion> {
    await this.member()
    const row = await this.row(id)
    if (!row) throw new SkillError('Skill not found.', 404)
    const requested =
      version === undefined
        ? row.version
        : z.number().int().positive().safe().parse(version)
    const [content] = await db
      .select({ document: chatSkillVersions.document })
      .from(chatSkillVersions)
      .where(
        and(
          eq(chatSkillVersions.skillId, id),
          eq(chatSkillVersions.version, requested),
        ),
      )
    if (!content) throw new SkillError('Skill version not found.', 404)
    await this.member()
    return {
      ...summary({
        ...row,
        version: requested,
        document: JSON.stringify(content.document),
      }),
      document: skillDocumentSchema.parse(content.document),
    }
  }
  async resolve(input: unknown): Promise<SkillVersion> {
    const selection = skillSelectionSchema.parse(input)
    const result = await this.inspect(selection.skillId, selection.version)
    const row = await this.row(selection.skillId)
    await this.member()
    if (
      result.archived ||
      !result.enabled ||
      !row ||
      !row.enabled ||
      row.archived
    )
      throw new SkillError(
        'This skill is disabled or archived. Enable it before using it.',
        409,
      )
    return result
  }
  private async receipt(
    commandId: string,
    requestHash: string,
    tx: Transaction,
  ) {
    const [existing] = await tx
      .select()
      .from(chatSkillCommands)
      .where(
        and(
          eq(chatSkillCommands.workspaceId, this.scope.workspaceId),
          eq(chatSkillCommands.userId, this.scope.userId),
          eq(chatSkillCommands.commandId, commandId),
        ),
      )
    if (!existing) return null
    if (existing.requestHash !== requestHash)
      throw new SkillError(
        'This command ID was already used for another change.',
        409,
      )
    return skillVersionSchema.parse(existing.receipt)
  }
  async command(input: unknown): Promise<SkillVersion> {
    const command = skillCommandSchema.parse(input)
    await this.member()
    const requestHash = await hash(canonical(command))
    const accepted = await db.transaction(async (tx) => {
      await this.member(tx)
      const replay = await this.receipt(command.commandId, requestHash, tx)
      if (replay) return replay
      const old = await this.row(command.id, tx)
      if (command.type === 'create' ? Boolean(old) : !old)
        throw new SkillError(
          command.type === 'create'
            ? 'Skill already exists.'
            : 'Skill not found.',
          command.type === 'create' ? 409 : 404,
        )
      if (
        command.type !== 'create' &&
        old?.revision !== command.expectedRevision
      )
        throw new SkillError(
          'This skill changed. Reload it before editing.',
          409,
        )
      if (
        old?.archived &&
        command.type !== 'restore' &&
        command.type !== 'archive'
      )
        throw new SkillError(
          'Restore this skill before editing or enabling it.',
          409,
        )
      if (command.type === 'create') {
        const [occupied] = await tx
          .select({ id: chatSkills.id })
          .from(chatSkills)
          .where(eq(chatSkills.id, command.id))
        if (occupied)
          throw new SkillError(
            'This skill changed. Reload it before editing.',
            409,
          )
        const [quota] = await tx
          .select({ count: sql<number>`count(*)::integer` })
          .from(chatSkills)
          .where(this.scoped())
        if (quota.count >= 200)
          throw new SkillError(
            'You can save up to 200 skills in this workspace, including archived skills.',
            409,
          )
      }
      const document =
        command.type === 'create' || command.type === 'update'
          ? command.document
          : skillDocumentSchema.parse(JSON.parse(old?.document ?? 'null'))
      const now = Date.now()
      const version =
        command.type === 'create'
          ? 1
          : (old?.version ?? 0) + (command.type === 'update' ? 1 : 0)
      const next: Row = {
        id: command.id,
        workspace_id: this.scope.workspaceId,
        user_id: this.scope.userId,
        version,
        revision: (old?.revision ?? 0) + 1,
        enabled:
          command.type === 'create'
            ? 1
            : command.type === 'enabled'
              ? Number(command.enabled)
              : command.type === 'archive' || command.type === 'restore'
                ? 0
                : (old?.enabled ?? 0),
        archived:
          command.type === 'archive'
            ? 1
            : command.type === 'restore'
              ? 0
              : (old?.archived ?? 0),
        created_at: old?.created_at ?? now,
        updated_at: now,
        document: JSON.stringify(document),
      }
      const receipt: SkillVersion = { ...summary(next), document }
      if (command.type === 'create') {
        const created = await tx
          .insert(chatSkills)
          .values({
            id: next.id,
            workspaceId: next.workspace_id,
            userId: next.user_id,
            version: next.version,
            revision: next.revision,
            enabled: Boolean(next.enabled),
            archived: Boolean(next.archived),
            createdAt: next.created_at,
            updatedAt: next.updated_at,
          })
          .onConflictDoNothing()
          .returning({ id: chatSkills.id })
        if (!created.length)
          throw new SkillError(
            'This skill changed. Reload it before editing.',
            409,
          )
      } else
        await tx
          .update(chatSkills)
          .set({
            version: next.version,
            revision: next.revision,
            enabled: Boolean(next.enabled),
            archived: Boolean(next.archived),
            updatedAt: next.updated_at,
          })
          .where(and(this.scoped(), eq(chatSkills.id, command.id)))
      if (command.type === 'create' || command.type === 'update')
        await tx.insert(chatSkillVersions).values({
          skillId: command.id,
          version,
          document,
          contentHash: await hash(canonical(document)),
          createdAt: now,
        })
      await tx.insert(chatSkillCommands).values({
        workspaceId: this.scope.workspaceId,
        userId: this.scope.userId,
        commandId: command.commandId,
        requestHash,
        receipt,
        createdAt: now,
      })
      return receipt
    })
    await this.member()
    return accepted
  }
}
