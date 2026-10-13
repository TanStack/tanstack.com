import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  workflowCommandSchema,
  workflowDefinitionSchema,
} from '../core/workflows'
import { hash } from './crypto'

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
type Scope = { conversationId: string; workspaceId: string; userId: string }
type Row = Record<string, unknown> & {
  workflow_id: string
  revision: number
  command_id: string
  request_hash: string
  definition_json: string
  archived: boolean
  created_at: number
}
const access = (scope: Scope, write: boolean) =>
  sql`EXISTS (SELECT 1 FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships member ON member.workspace_id=b.workspace_id AND member.user_id=c.user_id WHERE c.id=${scope.conversationId} AND b.workspace_id=${scope.workspaceId} AND c.user_id=${scope.userId} AND b.deleted_at IS NULL ${write ? sql`AND b.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_conversation_threads t WHERE t.conversation_id=c.id AND t.archived_at IS NOT NULL)` : sql``})`
const projection = sql`*,revision::double precision AS revision,definition_json::text AS definition_json,created_at::double precision AS created_at`
function view(row: Row) {
  return {
    id: row.workflow_id,
    revision: row.revision,
    archived: row.archived,
    definition: workflowDefinitionSchema.parse(JSON.parse(row.definition_json)),
    createdAt: row.created_at,
  }
}
/** Scope must come from authenticated conversation identity, never model input. */
export class Workflows {
  constructor(
    private scope: Scope,
    private now = () => Date.now(),
  ) {}
  private async authorize(write = false) {
    const [row] = await db.execute(
      sql`SELECT 1 WHERE ${access(this.scope, write)}`,
    )
    if (!row)
      throw new WorkflowError('Conversation access is unavailable.', 403)
  }
  async read(id: string, revision?: number) {
    z.uuid().parse(id)
    if (revision !== undefined)
      z.number().int().positive().safe().parse(revision)
    await this.authorize()
    const [row] = await db.execute<Row>(
      sql`SELECT ${projection} FROM chat_workflow_revisions WHERE conversation_id=${this.scope.conversationId} AND workflow_id=${id} ${revision === undefined ? sql`` : sql`AND revision=${revision}`} ORDER BY chat_workflow_revisions.revision DESC LIMIT 1`,
    )
    await this.authorize()
    if (!row) throw new WorkflowError('Workflow not found.', 404)
    return view(row)
  }
  async list(input: unknown = {}) {
    const query = z
      .strictObject({
        after: z.uuid().optional(),
        limit: z.number().int().min(1).max(25).default(10),
      })
      .parse(input)
    await this.authorize()
    const rows = await db.execute<Row>(
      sql`SELECT ${projection} FROM chat_workflow_revisions r WHERE r.conversation_id=${this.scope.conversationId} AND r.workflow_id::text>${query.after ?? ''} AND r.revision=(SELECT MAX(v.revision) FROM chat_workflow_revisions v WHERE v.conversation_id=r.conversation_id AND v.workflow_id=r.workflow_id) ORDER BY r.workflow_id LIMIT ${query.limit + 1}`,
    )
    await this.authorize()
    return {
      items: rows.slice(0, query.limit).map(view),
      ...(rows.length > query.limit
        ? { nextAfter: rows[query.limit - 1].workflow_id }
        : {}),
    }
  }
  async command(input: unknown, beforeCommit: () => void = () => {}) {
    beforeCommit()
    const command = workflowCommandSchema.parse(input)
    await this.authorize(true)
    const digest = await hash(JSON.stringify(command))
    const receipt = async () => {
      const [row] = await db.execute<Row>(
        sql`SELECT ${projection} FROM chat_workflow_revisions WHERE conversation_id=${this.scope.conversationId} AND command_id=${command.commandId}`,
      )
      if (row && row.request_hash !== digest)
        throw new WorkflowError(
          'This workflow command was already used for different input.',
          409,
        )
      return row ? view(row) : undefined
    }
    const old = await receipt()
    await this.authorize(true)
    beforeCommit()
    if (old) return old
    const definition =
      command.type === 'save'
        ? command.definition
        : (await this.read(command.id, command.expectedRevision)).definition
    beforeCommit()
    // One guarded insert is both the new immutable revision and retry receipt.
    // A competing writer cannot leave half a command committed.
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM chat_conversations WHERE id=${this.scope.conversationId} FOR UPDATE`,
      )
      beforeCommit()
      await tx.execute(sql`INSERT INTO chat_workflow_revisions(conversation_id,workflow_id,revision,workspace_id,user_id,command_id,request_hash,definition_json,archived,created_at)
      SELECT ${this.scope.conversationId},${command.id},${command.expectedRevision + 1},${this.scope.workspaceId},${this.scope.userId},${command.commandId},${digest},${JSON.stringify(definition)}::jsonb,${command.type === 'archive'},${this.now()}
      WHERE ${access(this.scope, true)} AND COALESCE((SELECT MAX(revision) FROM chat_workflow_revisions WHERE conversation_id=${this.scope.conversationId} AND workflow_id=${command.id}),0)=${command.expectedRevision} AND NOT EXISTS (SELECT 1 FROM chat_workflow_revisions WHERE conversation_id=${this.scope.conversationId} AND command_id=${command.commandId})`)
    })
    await this.authorize(true)
    const result = await receipt()
    await this.authorize(true)
    if (!result)
      throw new WorkflowError('Workflow changed. Reload before editing.', 409)
    return result
  }
}
