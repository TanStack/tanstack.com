import type { SqlStorage } from '@cloudflare/workers-types'
import { z } from 'zod'
import {
  acceptConversationRunSchema,
  conversationRunPatchSchema,
  conversationRunSchema,
  terminalRunStatuses,
  type AcceptConversationRun,
  type ConversationRun,
  type ConversationRunPatch,
  type ConversationRunPage,
  type ConversationRunStatus,
} from '../core/conversation-runs'

export class ConversationRunError extends Error {}
const cursorSchema = z
  .object({
    createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    id: z.string().min(1).max(128),
  })
  .strict()
const transitions: Record<
  ConversationRunStatus,
  readonly ConversationRunStatus[]
> = {
  queued: ['running', 'cancelled', 'failed', 'interrupted'],
  running: [
    'waiting_approval',
    'waiting_user',
    'waiting_children',
    'completed',
    'incomplete',
    'interrupted',
    'cancelled',
    'failed',
  ],
  waiting_approval: [
    'running',
    'waiting_user',
    'waiting_children',
    'incomplete',
    'interrupted',
    'cancelled',
    'failed',
    'completed',
  ],
  waiting_user: [
    'running',
    'waiting_approval',
    'incomplete',
    'interrupted',
    'cancelled',
    'failed',
    'completed',
  ],
  waiting_children: [
    'running',
    'interrupted',
    'cancelled',
    'failed',
    'incomplete',
  ],
  incomplete: ['running', 'cancelled'],
  interrupted: ['running', 'cancelled'],
  failed: ['running'],
  completed: [],
  cancelled: [],
}
/** Conversation-local receipts. The caller authorizes the exact DO before every operation.
 * Synchronous methods compose with the caller's storage.transactionSync save.
 * Never clear this table when resetting or copying transcript content.
 */
export class ConversationRuns {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS conversation_runs (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, status TEXT NOT NULL,
      workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, bot_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL, json TEXT NOT NULL
    )`)
    sql.exec(
      'CREATE INDEX IF NOT EXISTS conversation_runs_page ON conversation_runs(created_at DESC,id DESC)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS conversation_runs_status ON conversation_runs(status,created_at,id)',
    )
  }
  get(id: string): ConversationRun | undefined {
    const row = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM conversation_runs WHERE id=?',
        id,
      )
      .toArray()[0]
    return row ? conversationRunSchema.parse(JSON.parse(row.json)) : undefined
  }
  has(id: string) {
    return (
      this.sql.exec('SELECT id FROM conversation_runs WHERE id=?', id).toArray()
        .length > 0
    )
  }
  accept(input: AcceptConversationRun): ConversationRun {
    const parsed = acceptConversationRunSchema.parse(input)
    const old = this.get(parsed.id)
    if (old) {
      if (
        JSON.stringify(old.identity) !== JSON.stringify(parsed.identity) ||
        JSON.stringify(old.origin) !== JSON.stringify(parsed.origin) ||
        old.mode !== parsed.mode
      )
        throw new ConversationRunError(
          'This run ID already belongs to a different request.',
        )
      return old
    }
    const identity = parsed.identity
    const mismatch = this.sql
      .exec(
        `SELECT id FROM conversation_runs WHERE workspace_id<>? OR user_id<>? OR bot_id<>? OR conversation_id<>? LIMIT 1`,
        identity.workspaceId,
        identity.userId,
        identity.botId,
        identity.conversationId,
      )
      .toArray()
    if (mismatch.length)
      throw new ConversationRunError(
        'Run identity cannot change within a conversation.',
      )
    if (parsed.status === 'queued' && this.queued().length >= 100)
      throw new ConversationRunError('The run queue is full.')
    const run: ConversationRun = { ...parsed, updatedAt: parsed.createdAt }
    this.validateTimes(run)
    this.sql.exec(
      'INSERT INTO conversation_runs VALUES(?,?,?,?,?,?,?,?)',
      run.id,
      run.createdAt,
      run.status,
      identity.workspaceId,
      identity.userId,
      identity.botId,
      identity.conversationId,
      JSON.stringify(run),
    )
    return run
  }
  update(id: string, input: ConversationRunPatch): ConversationRun {
    const patch = conversationRunPatchSchema.parse(input),
      old = this.get(id)
    if (!old) throw new ConversationRunError('Run not found.')
    const status = patch.status ?? old.status
    if (status !== old.status && !transitions[old.status].includes(status))
      throw new ConversationRunError('Invalid run status transition.')
    if (
      old.startedAt !== undefined &&
      patch.startedAt !== undefined &&
      patch.startedAt !== old.startedAt
    )
      throw new ConversationRunError(
        'The original run start time cannot change.',
      )
    if (
      old.assistantTaskId &&
      patch.assistantTaskId &&
      old.assistantTaskId !== patch.assistantTaskId
    )
      throw new ConversationRunError('The run task cannot change.')
    const next: ConversationRun = {
      ...old,
      ...patch,
      status,
      updatedAt: patch.updatedAt ?? Math.max(old.updatedAt, Date.now()),
      completedAt:
        patch.completedAt === null
          ? undefined
          : (patch.completedAt ?? old.completedAt),
    }
    if (next.updatedAt < old.updatedAt)
      throw new ConversationRunError(
        'Run updates cannot move backward in time.',
      )
    this.validateTimes(next)
    this.sql.exec(
      'UPDATE conversation_runs SET status=?,json=? WHERE id=?',
      next.status,
      JSON.stringify(next),
      id,
    )
    return next
  }
  private validateTimes(run: ConversationRun) {
    if (
      (run.startedAt !== undefined && run.startedAt < run.createdAt) ||
      (run.completedAt !== undefined &&
        run.completedAt < (run.startedAt ?? run.createdAt)) ||
      run.updatedAt < run.createdAt
    )
      throw new ConversationRunError('Invalid run timestamps.')
    if (run.completedAt !== undefined && !terminalRunStatuses.has(run.status))
      throw new ConversationRunError(
        'An active run cannot have a completion time.',
      )
  }
  queued(): ConversationRun[] {
    return this.sql
      .exec<{ json: string }>(
        "SELECT json FROM conversation_runs WHERE status='queued' ORDER BY created_at,id LIMIT 100",
      )
      .toArray()
      .map((row) => conversationRunSchema.parse(JSON.parse(row.json)))
  }
  list(input: { limit?: number; cursor?: string } = {}): ConversationRunPage {
    const limit = z
      .number()
      .int()
      .min(1)
      .max(50)
      .parse(input.limit ?? 25)
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (input.cursor !== undefined) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(
            decodeURIComponent(z.string().max(4096).parse(input.cursor)),
          ),
        )
      } catch {
        throw new ConversationRunError('Invalid run history cursor.')
      }
    }
    const rows = cursor
      ? this.sql
          .exec<{ json: string }>(
            'SELECT json FROM conversation_runs WHERE created_at<? OR (created_at=? AND id<?) ORDER BY created_at DESC,id DESC LIMIT ?',
            cursor.createdAt,
            cursor.createdAt,
            cursor.id,
            limit + 1,
          )
          .toArray()
      : this.sql
          .exec<{ json: string }>(
            'SELECT json FROM conversation_runs ORDER BY created_at DESC,id DESC LIMIT ?',
            limit + 1,
          )
          .toArray()
    const items = rows
      .slice(0, limit)
      .map((row) => conversationRunSchema.parse(JSON.parse(row.json)))
    const last = items.at(-1)
    return {
      items,
      ...(rows.length > limit && last
        ? {
            nextCursor: encodeURIComponent(
              JSON.stringify({ createdAt: last.createdAt, id: last.id }),
            ),
          }
        : {}),
    }
  }
}
