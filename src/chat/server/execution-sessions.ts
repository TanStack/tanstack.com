import type { SqlStorage } from '@cloudflare/workers-types'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  maxSessionSnapshotBytes,
  maxSessionSnapshots,
  projectSnapshotRecordSchema,
} from '../core/execution-project-snapshot'
import {
  decodeExecutionBytes,
  emptyExecutionEventSummary,
  executionEventReadSchema,
  maxExecutionEventBatchBytes,
  maxExecutionEventBatchCount,
  maxExecutionEvents,
  maxExecutionOutputBytes,
  maxExecutionOutputEvents,
  type ExecutionEvent,
  type ExecutionEventPage,
  type ExecutionEventRead,
  type ExecutionEventSummary,
} from '../core/execution-events'
import {
  executionAuthoritySchema,
  executionArtifact,
  executionLeaseMs,
  executionSessionCommandSchema,
  executionSnapshotUploadSchema,
  executionOperationSchema,
  executionRunOriginSchema,
  executionTaskBindingSchema,
  executionTaskIdentitySchema,
  maxExecutionCommands,
  maxExecutionResponseBytes,
  maxExecutionSessions,
  type ExecutionAuthority,
  type ExecutionIdentity,
  type ExecutionOperation,
  type ExecutionRunOrigin,
  type ExecutionTaskAuthority,
  type ExecutionTaskBinding,
  type ExecutionTaskOutput,
  type ExecutionProcess,
  type ExecutionReceipt,
  type ExecutionResult,
  type ExecutionSession,
  type ExecutionSessionCommand,
  type ExecutionSessionHistory,
  type ExecutionSessionSnapshot,
} from '../core/execution-sessions'

export class ExecutionSessionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message)
    this.name = 'ExecutionSessionError'
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex')
const terminal = (state: ExecutionReceipt['state']) =>
  ['succeeded', 'failed', 'cancelled', 'unknown'].includes(state)
const inactive = (state: ExecutionSession['status']) =>
  state === 'closed' || state === 'abandoned'
type SessionRow = { id: string; data: string; proof_hash: string | null }
type ReceiptRow = { id: string; session_id: string; digest: string }
type HostCommand = Extract<
  ExecutionSessionCommand,
  { type: 'renew' | 'dispatch' | 'acknowledge' | 'append_events' }
>
type EventRow = { sequence: number; data: string; byte_length: number }
type ProcessExitEvent = Extract<ExecutionEvent, { type: 'process-exit' }>
type ProjectSnapshotRecord = z.infer<typeof projectSnapshotRecordSchema>
type SnapshotUpload = z.infer<typeof executionSnapshotUploadSchema>
type TaskCommandTarget = {
  origin: ExecutionRunOrigin
  binding: ExecutionTaskBinding
  commandId: string
}
const taskCommandTargetSchema = z
  .object({
    origin: executionRunOriginSchema,
    binding: executionTaskBindingSchema,
    commandId: z.uuid(),
  })
  .strict()
const taskEnqueueSchema = taskCommandTargetSchema
  .extend({
    operation: executionOperationSchema,
  })
  .strict()

/** All mutations must run in the caller's synchronous SQL transaction. No cached state. */
export class ExecutionSessions {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_sessions (id TEXT PRIMARY KEY,data TEXT NOT NULL,proof_hash TEXT)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_requests (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,digest TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_commands (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,data TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS execution_commands_session ON execution_commands(session_id)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_processes (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,data TEXT NOT NULL)',
    )
    sql.exec(
      `CREATE TABLE IF NOT EXISTS execution_events (
        session_id TEXT NOT NULL,sequence INTEGER NOT NULL,command_id TEXT NOT NULL,
        type TEXT NOT NULL,data TEXT NOT NULL,byte_length INTEGER NOT NULL,
        dropped_bytes INTEGER NOT NULL,PRIMARY KEY(session_id,sequence))`,
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS execution_events_command ON execution_events(session_id,command_id,sequence)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_project_snapshots (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,data TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE INDEX IF NOT EXISTS execution_project_snapshots_session ON execution_project_snapshots(session_id)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS execution_task_authorities (task_id TEXT PRIMARY KEY,data TEXT NOT NULL)',
    )
  }
  taskAuthority(
    identity: ExecutionIdentity,
    taskId: string,
  ): ExecutionTaskAuthority | undefined {
    this.identity(identity)
    if (typeof taskId !== 'string' || !taskId.length || taskId.length > 128)
      throw new ExecutionSessionError('Invalid execution task.', 400)
    const row = this.rows<{ data: string }>(
      'SELECT data FROM execution_task_authorities WHERE task_id=?',
      taskId,
    )[0]
    return row ? JSON.parse(row.data) : undefined
  }
  private saveTask(task: ExecutionTaskAuthority) {
    this.sql.exec(
      'INSERT INTO execution_task_authorities(task_id,data) VALUES (?,?) ON CONFLICT(task_id) DO UPDATE SET data=excluded.data',
      task.taskId,
      JSON.stringify(task),
    )
  }
  activateTask(
    identity: ExecutionIdentity,
    value: { runId: string; taskId: string; messageId: string },
    now: number,
  ): ExecutionTaskAuthority {
    this.identity(identity, true)
    this.now(now)
    const parsed = executionTaskIdentitySchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid execution task.', 400)
    const input = parsed.data
    const old = this.taskAuthority(identity, input.taskId)
    if (old) {
      if (old.runId !== input.runId || old.messageId !== input.messageId)
        throw new ExecutionSessionError(
          'This execution task belongs to a different run.',
        )
      if (!old.active)
        throw new ExecutionSessionError('This execution task has ended.')
      return old
    }
    const task: ExecutionTaskAuthority = {
      ...input,
      taskGeneration: 1,
      active: true,
    }
    this.saveTask(task)
    return task
  }
  cancelTask(identity: ExecutionIdentity, taskId: string, now: number): void {
    this.identity(identity)
    this.now(now)
    const task = this.taskAuthority(identity, taskId)
    if (!task?.active) return
    // A task has exactly one activation. Revocation advances its generation,
    // retaining the previous generation only for historical result reads.
    if (task.taskGeneration >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError(
        'Execution task generation limit reached.',
      )
    const changed = this.sessions()
      .map((session) => ({
        session,
        commands: this.commands(session.id).filter(
          (command) =>
            command.origin.kind === 'run' &&
            command.origin.taskId === task.taskId &&
            ['queued', 'dispatched', 'running'].includes(command.state),
        ),
      }))
      .filter((entry) => entry.commands.length)
    if (
      changed.some(({ session }) => session.version >= Number.MAX_SAFE_INTEGER)
    )
      throw new ExecutionSessionError('Execution version limit reached.')
    task.active = false
    task.taskGeneration++
    this.saveTask(task)
    for (const { session, commands } of changed) {
      for (const command of commands) {
        command.state = command.state === 'queued' ? 'cancelled' : 'unknown'
        command.stopRequested = true
        command.completedAt = now
        this.saveCommand(command)
      }
      this.bump(session, now)
    }
  }
  cancelActiveTasks(identity: ExecutionIdentity, now: number): void {
    this.identity(identity)
    this.now(now)
    const tasks: ExecutionTaskAuthority[] = this.rows<{ data: string }>(
      'SELECT data FROM execution_task_authorities',
    )
      .map((row) => JSON.parse(row.data))
      .filter((task) => task.active)
    const ids = new Set(tasks.map((task) => task.taskId))
    // Domain errors are committed by the caller. Preflight every affected row
    // so this bulk revocation cannot leave half of the authorities active.
    if (tasks.some((task) => task.taskGeneration >= Number.MAX_SAFE_INTEGER))
      throw new ExecutionSessionError(
        'Execution task generation limit reached.',
      )
    for (const session of this.sessions()) {
      const changes = new Set(
        this.commands(session.id).flatMap((command) =>
          command.origin.kind === 'run' &&
          ids.has(command.origin.taskId) &&
          ['queued', 'dispatched', 'running'].includes(command.state)
            ? [command.origin.taskId]
            : [],
        ),
      ).size
      if (session.version > Number.MAX_SAFE_INTEGER - changes)
        throw new ExecutionSessionError('Execution version limit reached.')
    }
    for (const task of tasks) this.cancelTask(identity, task.taskId, now)
  }
  private checkTask(
    identity: ExecutionIdentity,
    value: ExecutionRunOrigin,
    active: boolean,
  ) {
    const parsed = executionRunOriginSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid execution task origin.', 400)
    const origin = parsed.data
    const task = this.taskAuthority(identity, origin.taskId)
    if (
      !task ||
      task.runId !== origin.runId ||
      task.messageId !== origin.messageId ||
      origin.taskGeneration !==
        (task.active ? task.taskGeneration : task.taskGeneration - 1)
    )
      throw new ExecutionSessionError(
        'This command does not belong to the execution task.',
        404,
      )
    if (active && !task.active)
      throw new ExecutionSessionError('This execution task has ended.')
    return task
  }
  bindTask(
    identity: ExecutionIdentity,
    origin: ExecutionRunOrigin,
    authority: ExecutionAuthority,
    now: number,
  ): ExecutionTaskBinding {
    this.identity(identity)
    this.reconcile(authority, now)
    this.expire(now)
    const task = this.checkTask(identity, origin, true)
    const session = task.binding
      ? this.get(task.binding.sessionId)
      : this.sessions().find((item) => item.status === 'ready')
    if (
      !session ||
      session.status !== 'ready' ||
      !session.runtimeId ||
      session.leaseExpiresAt === undefined ||
      session.leaseExpiresAt <= now
    )
      throw new ExecutionSessionError(
        'Open a ready browser workspace before using workspace tools.',
      )
    const binding = {
      sessionId: session.id,
      hostGeneration: session.hostGeneration,
      runtimeId: session.runtimeId,
    }
    if (task.binding && canonical(task.binding) !== canonical(binding))
      throw new ExecutionSessionError(
        'This task is bound to a different browser workspace.',
      )
    if (!task.binding) {
      task.binding = binding
      this.saveTask(task)
    }
    return binding
  }
  enqueueTask(
    identity: ExecutionIdentity,
    value: TaskCommandTarget & { operation: ExecutionOperation },
    authority: ExecutionAuthority,
    now: number,
  ): ExecutionReceipt {
    this.identity(identity)
    const parsed = taskEnqueueSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid task workspace command.', 400)
    const input = parsed.data
    if (!['read_file', 'write_file', 'run'].includes(input.operation.type))
      throw new ExecutionSessionError(
        'This operation is not available to an assistant task.',
        403,
      )
    const binding = this.bindTask(identity, input.origin, authority, now)
    if (canonical(binding) !== canonical(input.binding))
      throw new ExecutionSessionError(
        'This command belongs to a different browser workspace.',
        409,
      )
    const hash = digest(canonical({ identity, input }))
    const old = this.rows<ReceiptRow>(
      'SELECT id,session_id,digest FROM execution_requests WHERE id=?',
      input.commandId,
    )[0]
    if (old) {
      if (old.digest !== hash)
        throw new ExecutionSessionError(
          'This execution command ID was used with different settings.',
        )
      return this.inspectTaskCommand(identity, {
        origin: input.origin,
        binding,
        commandId: input.commandId,
      })
    }
    const session = this.get(binding.sessionId)
    if (!session.runtime.capabilities.includes(input.operation.type))
      throw new ExecutionSessionError(
        'This operation is not granted to the runtime.',
        403,
      )
    if (this.commands(session.id).length >= maxExecutionCommands - 2)
      throw new ExecutionSessionError(
        'Execution command retention limit reached.',
        429,
      )
    if (session.version >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError('Execution version limit reached.')
    const command: ExecutionReceipt = {
      id: input.commandId,
      ...binding,
      digest: hash,
      origin: input.origin,
      operation: input.operation,
      state: 'queued',
      stopRequested: false,
      createdAt: now,
    }
    this.sql.exec(
      'INSERT INTO execution_commands(id,session_id,data) VALUES (?,?,?)',
      command.id,
      session.id,
      JSON.stringify(command),
    )
    this.record(command.id, session.id, hash)
    this.bump(session, now)
    return command
  }
  inspectTaskCommand(
    identity: ExecutionIdentity,
    value: TaskCommandTarget,
  ): ExecutionReceipt {
    this.identity(identity)
    const parsed = taskCommandTargetSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid task workspace target.', 400)
    const { origin, binding, commandId } = parsed.data
    const task = this.checkTask(identity, origin, false)
    if (!task.binding || canonical(task.binding) !== canonical(binding))
      throw new ExecutionSessionError(
        'This command belongs to a different browser workspace.',
        404,
      )
    const command = this.commands(binding.sessionId).find(
      (item) => item.id === commandId,
    )
    if (
      !command ||
      canonical(command.origin) !== canonical(origin) ||
      command.hostGeneration !== binding.hostGeneration ||
      command.runtimeId !== binding.runtimeId
    )
      throw new ExecutionSessionError('Execution task command not found.', 404)
    return command
  }
  readTaskOutput(
    identity: ExecutionIdentity,
    value: TaskCommandTarget & { after?: number },
  ): ExecutionTaskOutput {
    const { after = 0, ...target } = value
    const command = this.inspectTaskCommand(identity, target)
    if (!Number.isSafeInteger(after) || after < 0 || after > maxExecutionEvents)
      throw new ExecutionSessionError('Invalid execution output cursor.', 400)
    const summary = this.rows<{
      lastSequence: number
      outputBytes: number
      droppedBytes: number
    }>(
      'SELECT COALESCE(MAX(sequence),0) AS lastSequence, COALESCE(SUM(byte_length),0) AS outputBytes, COALESCE(SUM(dropped_bytes),0) AS droppedBytes FROM execution_events WHERE session_id=? AND command_id=?',
      command.sessionId,
      command.id,
    )[0]
    if (after > summary.lastSequence)
      throw new ExecutionSessionError('Invalid execution output cursor.', 400)
    const events: ExecutionEvent[] = []
    let bytes = 0
    for (const row of this.rows<EventRow>(
      'SELECT sequence,data,byte_length FROM execution_events WHERE session_id=? AND command_id=? AND sequence>? ORDER BY sequence LIMIT ?',
      command.sessionId,
      command.id,
      after,
      maxExecutionEventBatchCount,
    )) {
      if (bytes + row.byte_length > maxExecutionEventBatchBytes) break
      events.push(JSON.parse(row.data))
      bytes += row.byte_length
    }
    const nextSequence = events.at(-1)?.sequence ?? after
    return {
      sessionId: command.sessionId,
      commandId: command.id,
      after,
      nextSequence,
      events,
      hasMore: nextSequence < summary.lastSequence,
      outputBytes: summary.outputBytes,
      droppedBytes: summary.droppedBytes,
    }
  }
  private rows<T>(query: string, ...values: (string | number | null)[]): T[] {
    return this.sql.exec(query, ...values).toArray() as T[]
  }
  private meta(key: string): string | undefined {
    return this.rows<{ value: string }>(
      'SELECT value FROM execution_meta WHERE key=?',
      key,
    )[0]?.value
  }
  private identity(identity: ExecutionIdentity, bind = false) {
    if (
      !identity ||
      Object.keys(identity).sort().join(',') !==
        'botId,conversationId,userId,workspaceId' ||
      Object.values(identity).some(
        (value) =>
          typeof value !== 'string' || !value.length || value.length > 1000,
      )
    )
      throw new ExecutionSessionError('Execution conversation not found.', 404)
    const encoded = canonical(identity),
      stored = this.meta('identity')
    if (stored && stored !== encoded)
      throw new ExecutionSessionError('Execution conversation not found.', 404)
    if (!stored && bind)
      this.sql.exec(
        'INSERT INTO execution_meta(key,value) VALUES (?,?)',
        'identity',
        encoded,
      )
  }
  private now(now: number) {
    if (
      !Number.isSafeInteger(now) ||
      now < 0 ||
      now > Number.MAX_SAFE_INTEGER - executionLeaseMs
    )
      throw new ExecutionSessionError('Invalid execution timestamp.', 400)
  }
  private sessions(): ExecutionSession[] {
    return this.rows<{ data: string }>(
      'SELECT data FROM execution_sessions ORDER BY rowid',
    ).map((row) => JSON.parse(row.data))
  }
  private get(id: string): ExecutionSession {
    const row = this.rows<SessionRow>(
      'SELECT id,data,proof_hash FROM execution_sessions WHERE id=?',
      id,
    )[0]
    if (!row)
      throw new ExecutionSessionError('Execution session not found.', 404)
    return JSON.parse(row.data)
  }
  private save(session: ExecutionSession) {
    this.sql.exec(
      'UPDATE execution_sessions SET data=? WHERE id=?',
      JSON.stringify(session),
      session.id,
    )
  }
  private bump(session: ExecutionSession, now: number) {
    if (session.version >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError('Execution version limit reached.')
    session.version++
    session.updatedAt = now
    this.save(session)
  }
  private commands(sessionId: string): ExecutionReceipt[] {
    return this.rows<{ data: string }>(
      'SELECT data FROM execution_commands WHERE session_id=? ORDER BY rowid',
      sessionId,
    ).map((row) => JSON.parse(row.data))
  }
  private saveCommand(command: ExecutionReceipt) {
    this.sql.exec(
      'UPDATE execution_commands SET data=? WHERE id=?',
      JSON.stringify(command),
      command.id,
    )
  }
  private processes(sessionId: string): ExecutionProcess[] {
    return this.rows<{ data: string }>(
      'SELECT data FROM execution_processes WHERE session_id=? ORDER BY rowid',
      sessionId,
    ).map((row) => JSON.parse(row.data))
  }
  private eventSummary(sessionId: string): ExecutionEventSummary {
    const row = this.rows<ExecutionEventSummary>(
      `SELECT COALESCE(MAX(sequence),0) AS lastSequence,
       COALESCE(SUM(byte_length),0) AS outputBytes,
       COALESCE(SUM(CASE WHEN type='output' THEN 1 ELSE 0 END),0) AS outputEvents,
       COALESCE(SUM(dropped_bytes),0) AS droppedBytes
       FROM execution_events WHERE session_id=?`,
      sessionId,
    )[0]
    return row ?? emptyExecutionEventSummary()
  }
  private exitEvent(sessionId: string, commandId: string) {
    const row = this.rows<{ data: string }>(
      "SELECT data FROM execution_events WHERE session_id=? AND command_id=? AND type='process-exit' LIMIT 1",
      sessionId,
      commandId,
    )[0]
    return row ? (JSON.parse(row.data) as ProcessExitEvent) : undefined
  }
  /** Historical reads use an explicit session, never the current-session alias.
   * The caller rechecks current account/membership before entering this store. */
  events(
    identity: ExecutionIdentity,
    value: ExecutionEventRead,
  ): ExecutionEventPage {
    this.identity(identity)
    const parsed = executionEventReadSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid execution output cursor.', 400)
    const input = parsed.data
    const session = this.get(input.sessionId)
    if (canonical(session.identity) !== canonical(identity))
      throw new ExecutionSessionError('Execution session not found.', 404)
    const summary = this.eventSummary(session.id)
    if (input.after > summary.lastSequence)
      throw new ExecutionSessionError('Invalid execution output cursor.', 400)
    const events: ExecutionEvent[] = []
    let bytes = 0
    for (const row of this.rows<EventRow>(
      `SELECT sequence,data,byte_length FROM execution_events
       WHERE session_id=? AND sequence>? ORDER BY sequence LIMIT ?`,
      session.id,
      input.after,
      maxExecutionEventBatchCount,
    )) {
      if (bytes + row.byte_length > maxExecutionEventBatchBytes) break
      events.push(JSON.parse(row.data))
      bytes += row.byte_length
    }
    const nextSequence = events.at(-1)?.sequence ?? input.after
    return {
      sessionId: session.id,
      hostGeneration: session.hostGeneration,
      ...(session.runtimeId ? { runtimeId: session.runtimeId } : {}),
      after: input.after,
      nextSequence,
      summary,
      events,
      hasMore: nextSequence < summary.lastSequence,
    }
  }
  private saveProcess(process: ExecutionProcess) {
    this.sql.exec(
      'INSERT INTO execution_processes(id,session_id,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      process.id,
      process.sessionId,
      JSON.stringify(process),
    )
  }
  private receipt(
    input: ExecutionSessionCommand,
    identity: ExecutionIdentity,
  ): { old?: ReceiptRow; hash: string } {
    const safe =
      'leaseProof' in input
        ? { ...input, leaseProof: digest(input.leaseProof) }
        : input
    const hash = digest(
      canonical({
        identity,
        input:
          input.type === 'enqueue'
            ? { ...safe, origin: { kind: 'user' } }
            : safe,
      }),
    )
    const old =
      'commandId' in input
        ? this.rows<ReceiptRow>(
            'SELECT id,session_id,digest FROM execution_requests WHERE id=?',
            input.commandId,
          )[0]
        : undefined
    // Preserve immutable pre-origin user receipts on exact legacy retries.
    const legacyUserRetry =
      old &&
      input.type === 'enqueue' &&
      old.digest === digest(canonical({ identity, input: safe })) &&
      this.commands(old.session_id).some(
        (command) =>
          command.id === input.commandId && command.origin.kind === 'user',
      )
    if (old && old.digest !== hash && !legacyUserRetry)
      throw new ExecutionSessionError(
        'This execution command ID was used with different settings.',
      )
    return { old, hash: legacyUserRetry ? old.digest : hash }
  }
  private record(commandId: string, sessionId: string, hash: string) {
    this.sql.exec(
      'INSERT INTO execution_requests(id,session_id,digest) VALUES (?,?,?)',
      commandId,
      sessionId,
      hash,
    )
  }
  private cas(session: ExecutionSession, expected: number) {
    if (session.version !== expected)
      throw new ExecutionSessionError(
        'The execution session changed. Reload its current state.',
      )
  }
  private host(
    session: ExecutionSession,
    input: HostCommand | SnapshotUpload,
    now: number,
    closedReceipt = false,
  ) {
    const stored = this.rows<{ proof_hash: string | null }>(
      'SELECT proof_hash FROM execution_sessions WHERE id=?',
      session.id,
    )[0]?.proof_hash
    const actual = digest(input.leaseProof)
    if (
      !stored ||
      !timingSafeEqual(
        Buffer.from(stored, 'hex'),
        Buffer.from(actual, 'hex'),
      ) ||
      session.hostGeneration !== input.hostGeneration ||
      session.ownerInstanceId !== input.ownerInstanceId ||
      session.runtimeId !== input.runtimeId ||
      (!closedReceipt &&
        (!session.leaseExpiresAt ||
          session.leaseExpiresAt <= now ||
          !['ready', 'closing'].includes(session.status)))
    )
      throw new ExecutionSessionError(
        'The execution owner lease is no longer valid.',
        403,
      )
  }
  private projection(
    identity: ExecutionIdentity,
    sessionId?: string,
    delivery?: ExecutionReceipt,
  ): ExecutionSessionSnapshot {
    this.identity(identity)
    const session = sessionId
      ? this.get(sessionId)
      : (this.sessions().at(-1) ?? null)
    if (session && canonical(session.identity) !== canonical(identity))
      throw new ExecutionSessionError('Execution session not found.', 404)
    const snapshot: ExecutionSessionSnapshot = {
      session,
      commands: session ? this.commands(session.id) : [],
      processes: session ? this.processes(session.id) : [],
      ...(delivery ? { delivery } : {}),
      events: session
        ? this.eventSummary(session.id)
        : emptyExecutionEventSummary(),
      savedSnapshots: session ? this.projectSnapshots(session.id) : [],
      deferred: [],
    }
    if (Buffer.byteLength(JSON.stringify(snapshot)) > maxExecutionResponseBytes)
      throw new ExecutionSessionError(
        'Execution state exceeds the response limit.',
        500,
      )
    return snapshot
  }
  snapshot(
    identity: ExecutionIdentity,
    sessionId?: string,
  ): ExecutionSessionSnapshot {
    if (sessionId !== undefined && !z.uuid().safeParse(sessionId).success)
      throw new ExecutionSessionError(
        'Invalid execution session identity.',
        400,
      )
    return this.projection(identity, sessionId)
  }
  history(identity: ExecutionIdentity): ExecutionSessionHistory {
    this.identity(identity)
    const sessions = this.sessions().reverse()
    if (sessions.length > maxExecutionSessions)
      throw new ExecutionSessionError(
        'Execution history exceeds the session limit.',
        500,
      )
    if (
      sessions.some(
        (session) => canonical(session.identity) !== canonical(identity),
      )
    )
      throw new ExecutionSessionError('Execution session not found.', 404)
    const history = { sessions }
    if (Buffer.byteLength(JSON.stringify(history)) > maxExecutionResponseBytes)
      throw new ExecutionSessionError(
        'Execution history exceeds the response limit.',
        500,
      )
    return history
  }
  private projectSnapshots(sessionId: string): ProjectSnapshotRecord[] {
    return this.rows<{ data: string }>(
      'SELECT data FROM execution_project_snapshots WHERE session_id=? ORDER BY rowid',
      sessionId,
    ).map((row) => projectSnapshotRecordSchema.parse(JSON.parse(row.data)))
  }
  projectSnapshot(
    identity: ExecutionIdentity,
    snapshotId: string,
  ): ProjectSnapshotRecord {
    this.identity(identity)
    const row = this.rows<{ data: string }>(
      'SELECT data FROM execution_project_snapshots WHERE id=?',
      snapshotId,
    )[0]
    if (!row)
      throw new ExecutionSessionError('Project snapshot not found.', 404)
    const record = projectSnapshotRecordSchema.parse(JSON.parse(row.data))
    if (canonical(record.identity) !== canonical(identity))
      throw new ExecutionSessionError('Project snapshot not found.', 404)
    return record
  }
  /** Only the currently dispatched snapshot operation can reserve or publish.
   * A verified ready receipt stays immutable even if later shutdown interrupts
   * its separate command acknowledgment. */
  saveProjectSnapshot(
    identity: ExecutionIdentity,
    value: SnapshotUpload,
    authority: ExecutionAuthority,
    now: number,
    publish = false,
  ): ExecutionSessionSnapshot {
    this.identity(identity)
    const parsed = executionSnapshotUploadSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid project snapshot metadata.', 400)
    const input = parsed.data
    this.reconcile(authority, now)
    this.expire(now)
    const session = this.get(input.sessionId)
    const command = this.commands(session.id).find(
      (item) => item.id === input.commandId,
    )
    if (
      !command ||
      command.operation.type !== 'save_snapshot' ||
      command.digest !== input.digest ||
      command.id !== input.snapshot.snapshotId ||
      command.runtimeId !== input.runtimeId ||
      command.hostGeneration !== input.hostGeneration
    )
      throw new ExecutionSessionError(
        'The snapshot does not match its execution command.',
        409,
      )
    const prior = this.projectSnapshots(session.id).find(
      (item) => item.snapshotId === input.snapshot.snapshotId,
    )
    const expected = {
      ...input.snapshot,
      identity: { ...identity },
      sessionId: session.id,
      hostGeneration: input.hostGeneration,
      runtimeId: input.runtimeId,
      commandDigest: command.digest,
      artifact: { ...executionArtifact },
    }
    if (prior) {
      const { createdAt: _createdAt, state: _state, ...immutable } = prior
      if (canonical(immutable) !== canonical(expected))
        throw new ExecutionSessionError(
          'This snapshot ID already has different contents or metadata.',
          409,
        )
    }
    // Replaying a ready upload neither grants a new lease nor writes R2 again.
    // Its original host identity/proof must still match, and the caller repeats
    // current conversation authorization around this transaction.
    this.host(session, input, now, prior?.state === 'ready')
    if (prior?.state === 'ready') return this.projection(identity, session.id)
    if (prior?.state === 'unavailable')
      throw new ExecutionSessionError(
        'This project snapshot is unavailable.',
        409,
      )
    if (
      !['dispatched', 'running'].includes(command.state) ||
      session.status !== 'ready'
    )
      throw new ExecutionSessionError(
        'This snapshot command is no longer active.',
        409,
      )
    this.validateSnapshotTarget(session, command)
    if (!prior) {
      const snapshots = this.projectSnapshots(session.id)
      if (
        snapshots.length >= maxSessionSnapshots ||
        snapshots.reduce((sum, item) => sum + item.byteLength, 0) +
          input.snapshot.byteLength >
          maxSessionSnapshotBytes
      )
        throw new ExecutionSessionError(
          'Project snapshot storage is full (32 snapshots, 128 MiB per session).',
          429,
        )
      if (publish)
        throw new ExecutionSessionError(
          'Reserve the snapshot before publishing it.',
          409,
        )
    }
    if (session.version >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError('Execution version limit reached.')
    const record: ProjectSnapshotRecord = {
      ...expected,
      createdAt: prior?.createdAt ?? now,
      state: publish ? 'ready' : 'pending',
    }
    if (prior && !publish) return this.projection(identity, session.id)
    this.sql.exec(
      'INSERT INTO execution_project_snapshots(id,session_id,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      record.snapshotId,
      session.id,
      JSON.stringify(record),
    )
    this.bump(session, now)
    return this.projection(identity, session.id)
  }

  private disconnect(session: ExecutionSession, now: number) {
    for (const command of this.commands(session.id)) {
      if (command.state === 'queued') command.state = 'cancelled'
      else if (command.state === 'dispatched' || command.state === 'running')
        command.state = 'unknown'
      else continue
      command.completedAt = now
      this.saveCommand(command)
    }
    this.invalidatePendingSnapshots(session.id)
    for (const process of this.processes(session.id))
      if (process.state === 'running') {
        process.state = 'unknown'
        this.saveProcess(process)
      }
    session.status = 'disconnected'
    delete session.leaseExpiresAt
    this.bump(session, now)
  }
  reconcile(authority: ExecutionAuthority, now: number): void {
    this.now(now)
    const parsed = executionAuthoritySchema.safeParse(authority)
    if (!parsed.success)
      throw new ExecutionSessionError('Invalid execution authority.', 400)
    const stored = this.meta('authority')
    if (stored) {
      const previous: ExecutionAuthority = JSON.parse(stored)
      if (
        authority.lifecycleGeneration < previous.lifecycleGeneration ||
        authority.membershipGeneration < previous.membershipGeneration
      )
        throw new ExecutionSessionError(
          'Execution authority changed. Retry with current access.',
        )
    }
    this.sql.exec(
      'INSERT INTO execution_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'authority',
      canonical(authority),
    )
    for (const session of this.sessions())
      if (
        !inactive(session.status) &&
        (session.authority.lifecycleGeneration !==
          authority.lifecycleGeneration ||
          session.authority.membershipGeneration !==
            authority.membershipGeneration) &&
        session.status !== 'disconnected'
      )
        this.disconnect(session, now)
  }
  expire(now: number): void {
    this.now(now)
    for (const session of this.sessions())
      if (
        !inactive(session.status) &&
        session.leaseExpiresAt !== undefined &&
        session.leaseExpiresAt <= now
      )
        this.disconnect(session, now)
  }
  nextWake(): number | undefined {
    const values = this.sessions()
      .filter((session) => !inactive(session.status))
      .flatMap((session) =>
        session.leaseExpiresAt === undefined ? [] : [session.leaseExpiresAt],
      )
    return values.length ? Math.min(...values) : undefined
  }
  hasUnresolvedWork(): boolean {
    return this.sessions().some((session) => !inactive(session.status))
  }

  command(
    identity: ExecutionIdentity,
    value: ExecutionSessionCommand,
    authority: ExecutionAuthority,
    now: number,
  ): ExecutionSessionSnapshot {
    this.identity(identity, true)
    const parsed = executionSessionCommandSchema.safeParse(value)
    if (!parsed.success)
      throw new ExecutionSessionError(
        parsed.error.issues[0]?.message ?? 'Invalid execution command.',
        400,
      )
    const input = parsed.data
    this.reconcile(authority, now)
    this.expire(now)
    if (input.type === 'create') {
      const receipt = this.receipt(input, identity)
      if (receipt.old) return this.projection(identity, receipt.old.session_id)
      if (this.hasUnresolvedWork())
        throw new ExecutionSessionError(
          'Close or explicitly abandon the existing execution session first.',
        )
      if (this.sessions().length >= maxExecutionSessions)
        throw new ExecutionSessionError(
          'Execution session retention limit reached.',
          429,
        )
      if (input.project.source === 'snapshot') {
        const source = this.projectSnapshot(identity, input.project.snapshotId)
        if (
          source.state !== 'ready' ||
          source.sha256 !== input.project.digest ||
          canonical(source.artifact) !== canonical(executionArtifact)
        )
          throw new ExecutionSessionError(
            'Choose a ready, compatible project snapshot.',
            409,
          )
      }
      const session: ExecutionSession = {
        id: crypto.randomUUID(),
        identity: { ...identity },
        version: 1,
        status: 'awaiting_host',
        hostGeneration: 0,
        authority: { ...authority },
        runtime: input.runtime,
        project: input.project,
        createdAt: now,
        updatedAt: now,
      }
      this.sql.exec(
        'INSERT INTO execution_sessions(id,data) VALUES (?,?)',
        session.id,
        JSON.stringify(session),
      )
      this.record(input.commandId, session.id, receipt.hash)
      return this.projection(identity, session.id)
    }
    const session = this.get(input.sessionId)
    if (input.type === 'claim') {
      const receipt = this.receipt(input, identity)
      if (receipt.old) {
        this.host(
          session,
          { ...input, type: 'renew', hostGeneration: session.hostGeneration },
          now,
        )
        return this.projection(identity, session.id)
      }
      this.cas(session, input.expectedVersion)
      if (session.status !== 'awaiting_host')
        throw new ExecutionSessionError(
          'A new runtime requires a new session after explicit abandonment or confirmed shutdown.',
        )
      if (canonical(session.authority) !== canonical(authority))
        throw new ExecutionSessionError(
          'The session authority is no longer current.',
          403,
        )
      if (
        this.sessions().some(
          (previous) =>
            previous.id !== session.id &&
            previous.runtimeId === input.runtimeId,
        )
      )
        throw new ExecutionSessionError(
          'A new session requires a new runtime identity.',
        )
      session.status = 'ready'
      session.ownerInstanceId = input.ownerInstanceId
      session.runtimeId = input.runtimeId
      session.hostGeneration++
      session.leaseExpiresAt = now + executionLeaseMs
      session.runtime.capabilities = session.runtime.capabilities.filter(
        (capability) => input.runtime.capabilities.includes(capability),
      )
      this.sql.exec(
        'UPDATE execution_sessions SET proof_hash=? WHERE id=?',
        digest(input.leaseProof),
        session.id,
      )
      this.bump(session, now)
      this.record(input.commandId, session.id, receipt.hash)
      return this.projection(identity, session.id)
    }
    if (input.type === 'abandon') {
      const receipt = this.receipt(input, identity)
      if (receipt.old) return this.projection(identity, session.id)
      this.cas(session, input.expectedVersion)
      if (!['disconnected', 'awaiting_host'].includes(session.status))
        throw new ExecutionSessionError(
          'Close the current owner before abandoning this session.',
        )
      session.status = 'abandoned'
      this.bump(session, now)
      this.record(input.commandId, session.id, receipt.hash)
      return this.projection(identity, session.id)
    }
    if (input.type === 'enqueue') {
      const receipt = this.receipt(input, identity)
      if (receipt.old) return this.projection(identity, session.id)
      this.cas(session, input.expectedVersion)
      if (session.status !== 'ready' || !session.runtimeId)
        throw new ExecutionSessionError(
          'This execution session is not accepting work.',
        )
      if (!session.runtime.capabilities.includes(input.operation.type))
        throw new ExecutionSessionError(
          'This operation is not granted to the runtime.',
          403,
        )
      const commands = this.commands(session.id)
      const commandLimit =
        input.operation.type === 'close'
          ? maxExecutionCommands
          : input.operation.type === 'stop_process'
            ? maxExecutionCommands - 1
            : maxExecutionCommands - 2
      if (commands.length >= commandLimit)
        throw new ExecutionSessionError(
          'Execution command retention limit reached.',
          429,
        )
      const command: ExecutionReceipt = {
        id: input.commandId,
        sessionId: session.id,
        digest: receipt.hash,
        hostGeneration: session.hostGeneration,
        runtimeId: session.runtimeId,
        origin: { kind: 'user' },
        operation: input.operation,
        state: 'queued',
        stopRequested: false,
        createdAt: now,
        ...(input.operation.type === 'spawn'
          ? { processId: crypto.randomUUID() }
          : {}),
        ...(input.operation.type === 'preview_open'
          ? { previewId: crypto.randomUUID() }
          : {}),
      }
      this.validateTarget(session, command)
      if (input.operation.type === 'close') {
        session.status = 'closing'
        for (const previous of commands)
          if (!terminal(previous.state)) {
            if (previous.state === 'queued') {
              previous.state = 'cancelled'
              previous.completedAt = now
            } else previous.stopRequested = true
            this.saveCommand(previous)
          }
        this.invalidatePendingSnapshots(session.id)
      }
      if (input.operation.type === 'stop_process')
        for (const previous of commands)
          if (previous.processId === input.operation.processId) {
            previous.stopRequested = true
            this.saveCommand(previous)
          }
      this.sql.exec(
        'INSERT INTO execution_commands(id,session_id,data) VALUES (?,?,?)',
        command.id,
        session.id,
        JSON.stringify(command),
      )
      this.record(input.commandId, session.id, receipt.hash)
      this.bump(session, now)
      return this.projection(identity, session.id)
    }
    const settledClose =
      input.type === 'acknowledge' &&
      session.status === 'closed' &&
      this.commands(session.id).some(
        (command) =>
          command.id === input.commandId &&
          command.operation.type === 'close' &&
          command.state === 'succeeded',
      )
    this.host(session, input, now, settledClose)
    if (input.type === 'append_events')
      return this.appendEvents(identity, session, input.events, now)
    if (input.type === 'renew') {
      session.leaseExpiresAt = Math.max(
        session.leaseExpiresAt!,
        now + executionLeaseMs,
      )
      session.updatedAt = Math.max(session.updatedAt, now)
      this.save(session)
      return this.projection(identity, session.id)
    }
    if (input.type === 'dispatch') {
      let selected: ExecutionReceipt | undefined
      for (let index = 0; index < maxExecutionCommands; index++) {
        const commands = this.commands(session.id)
        const bypass = (command: ExecutionReceipt) =>
          command.operation.type === 'close' ||
          command.operation.type === 'stop_process'
        const inFlight = commands.filter(
          (command) =>
            command.state === 'dispatched' ||
            command.state === 'running' ||
            (command.state === 'unknown' &&
              command.stopRequested &&
              command.origin.kind === 'run'),
        )
        // Close can interrupt work, but another stop never overtakes an in-flight stop.
        selected =
          commands.find(
            (command) =>
              command.state === 'queued' && command.operation.type === 'close',
          ) ??
          inFlight.find(bypass) ??
          commands.find(
            (command) => command.state === 'queued' && bypass(command),
          ) ??
          inFlight[0] ??
          commands.find((command) => command.state === 'queued')
        if (selected?.state === 'unknown') {
          // The owner can settle or stop this exact envelope. Never redeliver it
          // as new work, and do not let ordinary work overtake its unknown effect.
          selected = undefined
          break
        }
        if (selected?.origin.kind === 'run') {
          try {
            const task = this.checkTask(identity, selected.origin, true)
            if (
              !task.binding ||
              canonical(task.binding) !==
                canonical({
                  sessionId: session.id,
                  hostGeneration: session.hostGeneration,
                  runtimeId: session.runtimeId,
                })
            )
              throw new ExecutionSessionError(
                'This execution task belongs to another runtime.',
              )
          } catch (error) {
            if (!(error instanceof ExecutionSessionError)) throw error
            if (session.version >= Number.MAX_SAFE_INTEGER)
              throw new ExecutionSessionError(
                'Execution version limit reached.',
              )
            selected.state =
              selected.state === 'queued' ? 'cancelled' : 'unknown'
            selected.stopRequested = true
            selected.completedAt = now
            this.saveCommand(selected)
            this.bump(session, now)
            selected = undefined
            continue
          }
        }
        if (selected?.state !== 'queued') break
        try {
          this.validateTarget(session, selected)
        } catch (error) {
          if (
            !(error instanceof ExecutionSessionError) ||
            ![404, 409].includes(error.status)
          )
            throw error
          // No dispatch ever occurred, so cancellation does not claim a guest effect stopped.
          selected.state = 'cancelled'
          selected.completedAt = now
          selected.error = {
            code: 'TARGET_UNAVAILABLE',
            message: error.message,
          }
          this.saveCommand(selected)
          this.bump(session, now)
          selected = undefined
          continue
        }
        selected.state = 'dispatched'
        selected.dispatchedAt = now
        this.saveCommand(selected)
        break
      }
      return this.projection(identity, session.id, selected)
    }
    return this.acknowledge(identity, session, input, now)
  }

  private appendEvents(
    identity: ExecutionIdentity,
    session: ExecutionSession,
    events: ExecutionEvent[],
    now: number,
  ) {
    const summary = this.eventSummary(session.id)
    const commands = new Map(
      this.commands(session.id).map((item) => [item.id, item]),
    )
    const processes = new Map(
      this.processes(session.id).map((item) => [item.id, item]),
    )
    const exits = new Map<string, ProcessExitEvent>()
    for (const row of this.rows<{ data: string }>(
      "SELECT data FROM execution_events WHERE session_id=? AND type='process-exit'",
      session.id,
    )) {
      const event = JSON.parse(row.data) as ProcessExitEvent
      exits.set(event.commandId, event)
    }
    const additions: { event: ExecutionEvent; data: string; bytes: number }[] =
      []
    const changedProcesses = new Map<string, ExecutionProcess>()
    // Validate the entire batch first. The caller intentionally catches domain
    // errors inside its transaction to retain independent lease-expiry changes.
    for (const event of events) {
      const data = canonical(event)
      const retained = this.rows<{ data: string }>(
        'SELECT data FROM execution_events WHERE session_id=? AND sequence=?',
        session.id,
        event.sequence,
      )[0]
      if (retained) {
        if (retained.data !== data)
          throw new ExecutionSessionError(
            'This execution event was already recorded differently.',
          )
        continue
      }
      if (event.sequence !== summary.lastSequence + 1)
        throw new ExecutionSessionError(
          'Execution output has a missing or reordered event.',
        )
      const command = commands.get(event.commandId)
      if (
        !command ||
        command.digest !== event.digest ||
        command.hostGeneration !== session.hostGeneration ||
        command.runtimeId !== session.runtimeId ||
        !['run', 'spawn'].includes(command.operation.type) ||
        (command.operation.type === 'run'
          ? (!['dispatched', 'running'].includes(command.state) &&
              !this.acceptsLateTaskEvidence(identity, command)) ||
            event.processId !== undefined
          : !['dispatched', 'running', 'succeeded'].includes(command.state) ||
            event.processId !== command.processId)
      )
        throw new ExecutionSessionError(
          'This output does not belong to an active dispatched command.',
        )
      const process = command.processId
        ? processes.get(command.processId)
        : undefined
      const existingExit = exits.get(command.id)
      let bytes = 0
      if (event.type === 'process-exit') {
        if (command.operation.type !== 'spawn' || existingExit)
          throw new ExecutionSessionError(
            'This process already has exit evidence or is unavailable.',
          )
        if (process && process.state !== 'running') {
          // A Stop acknowledgment can win this race. Retain matching observed
          // exit evidence without replacing its stronger disposal receipt.
          if (
            process.state !== 'stopped' ||
            process.stoppedBy !== 'process_receipt' ||
            canonical(process.exit) !==
              canonical({ exitCode: event.exitCode, signal: event.signal })
          )
            throw new ExecutionSessionError(
              'This process exit conflicts with its terminal evidence.',
            )
        }
        exits.set(command.id, event)
        if (process?.state === 'running') {
          process.state = 'exited'
          process.exit = { exitCode: event.exitCode, signal: event.signal }
          process.stoppedBy = 'process_event'
          changedProcesses.set(process.id, process)
        }
      } else {
        if (existingExit || (process && process.state !== 'running'))
          throw new ExecutionSessionError(
            'Output after observed process exit cannot be accepted.',
          )
        if (event.type === 'output') {
          bytes = decodeExecutionBytes(event.dataBase64).length
          summary.outputBytes += bytes
          summary.outputEvents++
          if (
            summary.outputBytes > maxExecutionOutputBytes ||
            summary.outputEvents > maxExecutionOutputEvents
          )
            throw new ExecutionSessionError(
              'Execution output retention is full. Record an output gap instead.',
              429,
            )
        } else {
          if (
            event.droppedBytes >
            Number.MAX_SAFE_INTEGER - summary.droppedBytes
          )
            throw new ExecutionSessionError(
              'Execution dropped-byte count exceeds its limit.',
              400,
            )
          summary.droppedBytes += event.droppedBytes
        }
      }
      summary.lastSequence = event.sequence
      if (summary.lastSequence > maxExecutionEvents)
        throw new ExecutionSessionError(
          'Execution event retention is full.',
          429,
        )
      additions.push({ event, data, bytes })
    }
    if (changedProcesses.size && session.version >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError('Execution version limit reached.')
    for (const { event, data, bytes } of additions)
      this.sql.exec(
        `INSERT INTO execution_events(session_id,sequence,command_id,type,data,byte_length,dropped_bytes)
         VALUES (?,?,?,?,?,?,?)`,
        session.id,
        event.sequence,
        event.commandId,
        event.type,
        data,
        bytes,
        event.type === 'output-gap' ? event.droppedBytes : 0,
      )
    for (const process of changedProcesses.values()) this.saveProcess(process)
    if (changedProcesses.size) this.bump(session, now)
    return this.projection(identity, session.id)
  }

  private validateSnapshotTarget(
    session: ExecutionSession,
    command: ExecutionReceipt,
  ) {
    const commands = this.commands(session.id)
    if (
      this.processes(session.id).some(
        (process) => process.state !== 'stopped',
      ) ||
      commands.some(
        (item) =>
          item.id !== command.id &&
          ['dispatched', 'running', 'unknown'].includes(item.state),
      ) ||
      commands.some(
        (item) =>
          item.operation.type === 'preview_open' &&
          item.state === 'succeeded' &&
          !this.previewClosed(session.id, item.previewId!),
      )
    )
      throw new ExecutionSessionError(
        'Finish current work, clean up processes, and close previews before saving a snapshot.',
        409,
      )
  }
  private invalidatePendingSnapshots(sessionId: string, commandId?: string) {
    for (const record of this.projectSnapshots(sessionId))
      if (
        record.state === 'pending' &&
        (!commandId || record.snapshotId === commandId)
      ) {
        record.state = 'unavailable'
        this.sql.exec(
          'UPDATE execution_project_snapshots SET data=? WHERE id=?',
          JSON.stringify(record),
          record.snapshotId,
        )
      }
  }
  private validateTarget(session: ExecutionSession, command: ExecutionReceipt) {
    const operation = command.operation
    if (operation.type === 'save_snapshot')
      this.validateSnapshotTarget(session, command)
    if (
      operation.type === 'stop_process' ||
      operation.type === 'preview_open'
    ) {
      const process = this.processes(session.id).find(
        (item) => item.id === operation.processId,
      )
      if (
        !process ||
        process.runtimeId !== session.runtimeId ||
        process.hostGeneration !== session.hostGeneration ||
        (process.state !== 'running' &&
          !(operation.type === 'stop_process' && process.state === 'exited'))
      )
        throw new ExecutionSessionError(
          'The process is not running in this runtime.',
          404,
        )
    }
    if (
      operation.type === 'stop_process' &&
      this.commands(session.id).some(
        (previous) =>
          previous.id !== command.id &&
          previous.operation.type === 'stop_process' &&
          previous.operation.processId === operation.processId &&
          !terminal(previous.state),
      )
    )
      throw new ExecutionSessionError(
        'This process already has a pending stop command.',
      )
    if (
      operation.type === 'preview_open' &&
      this.commands(session.id).some(
        (item) =>
          item.id !== command.id &&
          item.operation.type === 'preview_open' &&
          !['failed', 'cancelled', 'unknown'].includes(item.state) &&
          !this.previewClosed(session.id, item.previewId!),
      )
    )
      throw new ExecutionSessionError('Close the existing preview first.')
    if ('previewId' in operation) {
      const opened = this.commands(session.id).find(
        (item) =>
          item.previewId === operation.previewId &&
          item.operation.type === 'preview_open' &&
          item.state === 'succeeded',
      )
      if (
        !opened ||
        opened.runtimeId !== session.runtimeId ||
        this.previewClosed(session.id, operation.previewId)
      )
        throw new ExecutionSessionError(
          'The owned preview is not available.',
          404,
        )
    }
  }
  private previewClosed(sessionId: string, previewId: string) {
    return this.commands(sessionId).some(
      (item) =>
        item.operation.type === 'preview_close' &&
        item.operation.previewId === previewId &&
        item.state === 'succeeded',
    )
  }
  private validateResult(command: ExecutionReceipt, result: ExecutionResult) {
    if (result.type !== command.operation.type)
      throw new ExecutionSessionError(
        'The result does not match the execution operation.',
        400,
      )
    if (result.type === 'save_snapshot') {
      const saved = this.projectSnapshots(command.sessionId).find(
        (item) => item.snapshotId === command.id,
      )
      const { type: _type, ...metadata } = result
      if (
        !saved ||
        saved.state !== 'ready' ||
        result.snapshotId !== command.id ||
        saved.commandDigest !== command.digest ||
        Object.entries(metadata).some(
          ([key, value]) => saved[key as keyof ProjectSnapshotRecord] !== value,
        )
      )
        throw new ExecutionSessionError(
          'Upload and verify this project snapshot before acknowledging it.',
          409,
        )
    }
    if (
      (result.type === 'spawn' && result.processId !== command.processId) ||
      (result.type === 'preview_open' && result.previewId !== command.previewId)
    )
      throw new ExecutionSessionError(
        'The acquired handle does not match this command.',
        400,
      )
    if (
      ('processId' in result &&
        'processId' in command.operation &&
        result.processId !== command.operation.processId) ||
      ('previewId' in result &&
        'previewId' in command.operation &&
        result.previewId !== command.operation.previewId)
    )
      throw new ExecutionSessionError(
        'The result target does not match this command.',
        400,
      )
    if (result.type === 'read_file' || result.type === 'write_file') {
      const text =
        result.type === 'read_file'
          ? result.text
          : command.operation.type === 'write_file'
            ? command.operation.text
            : ''
      if (
        Buffer.byteLength(text) !== result.byteLength ||
        digest(text) !== result.sha256
      )
        throw new ExecutionSessionError(
          'The reported file bytes do not match their receipt.',
          400,
        )
    }
  }
  /** Only a live original host may settle a task-cancelled admitted effect.
   * Host fencing is checked by command() before this evidence predicate. */
  private acceptsLateTaskEvidence(
    identity: ExecutionIdentity,
    command: ExecutionReceipt,
  ): boolean {
    if (
      command.state !== 'unknown' ||
      !command.stopRequested ||
      command.origin.kind !== 'run' ||
      command.dispatchedAt === undefined
    )
      return false
    try {
      const task = this.checkTask(identity, command.origin, false)
      return (
        !task.active &&
        canonical(task.binding ?? null) ===
          canonical({
            sessionId: command.sessionId,
            hostGeneration: command.hostGeneration,
            runtimeId: command.runtimeId,
          })
      )
    } catch {
      return false
    }
  }
  private acknowledge(
    identity: ExecutionIdentity,
    session: ExecutionSession,
    input: Extract<HostCommand, { type: 'acknowledge' }>,
    now: number,
  ) {
    const command = this.commands(session.id).find(
      (item) => item.id === input.commandId,
    )
    if (
      !command ||
      command.digest !== input.digest ||
      command.hostGeneration !== input.hostGeneration ||
      command.runtimeId !== input.runtimeId
    )
      throw new ExecutionSessionError(
        'The execution receipt does not match this runtime.',
        409,
      )
    const lateTaskEvidence = this.acceptsLateTaskEvidence(identity, command)
    if (
      command.state === 'queued' ||
      command.state === 'cancelled' ||
      (command.state === 'unknown' && !lateTaskEvidence) ||
      (lateTaskEvidence && input.outcome === 'running')
    )
      throw new ExecutionSessionError(
        'This execution command cannot accept a result.',
      )
    if (terminal(command.state) && !lateTaskEvidence) {
      if (
        command.state !== input.outcome ||
        (command.eventsThrough ?? 0) !== input.eventsThrough ||
        canonical(command.result ?? null) !== canonical(input.result ?? null) ||
        canonical(command.error ?? null) !== canonical(input.error ?? null)
      )
        throw new ExecutionSessionError(
          'This execution result was already recorded differently.',
        )
      return this.projection(identity, session.id)
    }
    const summary = this.eventSummary(session.id)
    const targetProcessId =
      command.operation.type === 'stop_process'
        ? command.operation.processId
        : undefined
    const processTarget = targetProcessId
      ? this.processes(session.id).find((item) => item.id === targetProcessId)
      : undefined
    const targetCommandId = processTarget?.commandId ?? command.id
    // Spawn confirms handle acquisition, not EOF. Its process can legitimately
    // append more evidence while the captured acknowledgment is in flight.
    // Likewise a running acknowledgment is not a drained terminal result.
    const requiredSequence =
      command.operation.type === 'spawn' || input.outcome === 'running'
        ? 0
        : command.operation.type === 'close'
          ? summary.lastSequence
          : this.rows<{ sequence: number }>(
              'SELECT COALESCE(MAX(sequence),0) AS sequence FROM execution_events WHERE session_id=? AND command_id=?',
              session.id,
              targetCommandId,
            )[0].sequence
    if (
      input.eventsThrough > summary.lastSequence ||
      input.eventsThrough < requiredSequence ||
      input.eventsThrough < (command.eventsThrough ?? 0)
    )
      throw new ExecutionSessionError(
        'Persist this command’s output before acknowledging its result.',
      )
    if (input.outcome === 'running') {
      command.state = 'running'
      command.eventsThrough = input.eventsThrough
      this.saveCommand(command)
      return this.projection(identity, session.id)
    }
    if (input.result) this.validateResult(command, input.result)
    const result = input.result
    if (
      result?.type === 'spawn' &&
      this.processes(session.id).some(
        (item) =>
          ['running', 'exited'].includes(item.state) && item.pid === result.pid,
      )
    )
      throw new ExecutionSessionError(
        'This process handle is already owned by another command.',
      )
    const stoppedProcess =
      result?.type === 'stop_process'
        ? this.processes(session.id).find(
            (item) => item.id === result.processId,
          )
        : undefined
    if (
      result?.type === 'stop_process' &&
      (!stoppedProcess ||
        (stoppedProcess.state !== 'running' &&
          !(
            stoppedProcess.state === 'exited' &&
            canonical(stoppedProcess.exit) ===
              canonical({ exitCode: result.exitCode, signal: result.signal })
          )))
    )
      throw new ExecutionSessionError(
        'The process already has terminal evidence or is unavailable.',
        409,
      )
    if (session.version >= Number.MAX_SAFE_INTEGER)
      throw new ExecutionSessionError('Execution version limit reached.')
    const pendingExit =
      result?.type === 'spawn'
        ? this.exitEvent(session.id, command.id)
        : undefined
    command.state = input.outcome
    command.completedAt = now
    command.eventsThrough = input.eventsThrough
    if (input.result) command.result = input.result
    if (input.error) command.error = input.error
    this.saveCommand(command)
    if (
      input.outcome === 'failed' &&
      command.operation.type === 'save_snapshot'
    )
      this.invalidatePendingSnapshots(session.id, command.id)
    if (input.result?.type === 'spawn') {
      this.saveProcess({
        id: input.result.processId,
        sessionId: session.id,
        commandId: command.id,
        hostGeneration: session.hostGeneration,
        runtimeId: session.runtimeId!,
        pid: input.result.pid,
        state: pendingExit ? 'exited' : 'running',
        ...(pendingExit
          ? {
              exit: {
                exitCode: pendingExit.exitCode,
                signal: pendingExit.signal,
              },
              stoppedBy: 'process_event' as const,
            }
          : {}),
        createdAt: now,
      })
    }
    if (input.result?.type === 'stop_process') {
      const process = stoppedProcess!
      process.state = 'stopped'
      process.exit = {
        exitCode: input.result.exitCode,
        signal: input.result.signal,
      }
      process.stoppedBy = 'process_receipt'
      this.saveProcess(process)
    }
    if (input.result?.type === 'close') {
      session.status = 'closed'
      delete session.leaseExpiresAt
      for (const previous of this.commands(session.id))
        if (!terminal(previous.state)) {
          previous.state = previous.state === 'queued' ? 'cancelled' : 'unknown'
          previous.completedAt = now
          this.saveCommand(previous)
        }
      for (const process of this.processes(session.id))
        if (process.state === 'running' || process.state === 'exited') {
          process.state = 'stopped'
          process.stoppedBy = 'kernel_shutdown'
          this.saveProcess(process)
        }
      this.invalidatePendingSnapshots(session.id)
    } else if (input.outcome === 'failed' && command.operation.type === 'close')
      this.disconnect(session, now)
    this.bump(session, now)
    return this.projection(identity, session.id)
  }
}
