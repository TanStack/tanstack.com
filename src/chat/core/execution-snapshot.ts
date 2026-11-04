import { z } from 'zod'
import {
  executionProjectSchema,
  projectSnapshotRecordSchema,
  maxSessionSnapshots,
} from './execution-project-snapshot'
import {
  executionEventSummarySchema,
  maxExecutionEvents,
} from './execution-events'
import {
  executionAuthoritySchema,
  executionOperationSchema,
  executionOriginSchema,
  executionResultSchema,
  executionRuntimeSchema,
  maxExecutionCommands,
  maxExecutionSessions,
  type ExecutionIdentity,
  type ExecutionSessionHistory,
  type ExecutionSessionSnapshot,
} from './execution-sessions'

const id = z.uuid()
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const positive = integer.min(1)
const identitySchema = z
  .object({
    userId: z.string().min(1).max(1000),
    workspaceId: z.string().min(1).max(1000),
    botId: z.string().min(1).max(1000),
    conversationId: z.string().min(1).max(1000),
  })
  .strict()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const errorSchema = z
  .object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(512),
  })
  .strict()
const sessionSchema = z
  .object({
    id,
    identity: identitySchema,
    version: positive,
    status: z.enum([
      'awaiting_host',
      'ready',
      'disconnected',
      'closing',
      'closed',
      'abandoned',
    ]),
    hostGeneration: integer,
    ownerInstanceId: id.optional(),
    runtimeId: id.optional(),
    leaseExpiresAt: integer.optional(),
    authority: executionAuthoritySchema,
    runtime: executionRuntimeSchema,
    project: executionProjectSchema,
    createdAt: integer,
    updatedAt: integer,
  })
  .strict()
  .refine((session) => {
    const claimed = session.hostGeneration > 0
    if (
      claimed !==
      (session.ownerInstanceId !== undefined && session.runtimeId !== undefined)
    )
      return false
    if (
      !claimed &&
      (session.ownerInstanceId !== undefined || session.runtimeId !== undefined)
    )
      return false
    if (session.status === 'awaiting_host')
      return !claimed && session.leaseExpiresAt === undefined
    if (session.status === 'ready' || session.status === 'closing')
      return claimed && session.leaseExpiresAt !== undefined
    return (
      session.leaseExpiresAt === undefined &&
      (session.status !== 'closed' || claimed)
    )
  }, 'Invalid execution ownership state.')
const receiptSchema = z
  .object({
    id,
    sessionId: id,
    digest: hash,
    hostGeneration: positive,
    runtimeId: id,
    origin: executionOriginSchema,
    operation: executionOperationSchema,
    state: z.enum([
      'queued',
      'dispatched',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'unknown',
    ]),
    stopRequested: z.boolean(),
    createdAt: integer,
    dispatchedAt: integer.optional(),
    completedAt: integer.optional(),
    eventsThrough: integer.max(maxExecutionEvents).optional(),
    processId: id.optional(),
    previewId: id.optional(),
    result: executionResultSchema.optional(),
    error: errorSchema.optional(),
  })
  .strict()
  .refine((receipt) => {
    if (
      (receipt.operation.type === 'spawn') !==
      (receipt.processId !== undefined)
    )
      return false
    if (
      (receipt.operation.type === 'preview_open') !==
      (receipt.previewId !== undefined)
    )
      return false
    if (receipt.state === 'succeeded') {
      if (
        !receipt.result ||
        receipt.error ||
        receipt.result.type !== receipt.operation.type
      )
        return false
    } else if (receipt.result !== undefined) return false
    if (receipt.state === 'failed' && !receipt.error) return false
    if (
      receipt.error &&
      receipt.state !== 'failed' &&
      receipt.state !== 'cancelled'
    )
      return false
    if (['queued', 'cancelled'].includes(receipt.state)) {
      if (receipt.dispatchedAt !== undefined) return false
    } else if (receipt.dispatchedAt === undefined) return false
    if (
      ['succeeded', 'failed', 'cancelled', 'unknown'].includes(
        receipt.state,
      ) !==
      (receipt.completedAt !== undefined)
    )
      return false
    const result = receipt.result
    if (result?.type === 'spawn' && result.processId !== receipt.processId)
      return false
    if (
      result?.type === 'preview_open' &&
      result.previewId !== receipt.previewId
    )
      return false
    if (
      result &&
      'processId' in result &&
      'processId' in receipt.operation &&
      result.processId !== receipt.operation.processId
    )
      return false
    if (
      result &&
      'previewId' in result &&
      'previewId' in receipt.operation &&
      result.previewId !== receipt.operation.previewId
    )
      return false
    return true
  }, 'Invalid execution receipt.')
const processSchema = z
  .object({
    id,
    sessionId: id,
    commandId: id,
    hostGeneration: positive,
    runtimeId: id,
    pid: z.number().int().positive().max(2147483647),
    state: z.enum(['running', 'stopped', 'exited', 'unknown']),
    createdAt: integer,
    exit: z
      .object({
        exitCode: z.number().int().min(-128).max(255).nullable(),
        signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).nullable(),
      })
      .strict()
      .refine((exit) => exit.exitCode !== null || exit.signal !== null)
      .optional(),
    stoppedBy: z
      .enum(['process_receipt', 'kernel_shutdown', 'process_event'])
      .optional(),
  })
  .strict()
  .refine(
    (process) =>
      process.state === 'exited'
        ? process.stoppedBy === 'process_event' && process.exit !== undefined
        : process.state === 'stopped'
          ? process.stoppedBy !== undefined &&
            process.stoppedBy !== 'process_event' &&
            (process.stoppedBy !== 'process_receipt' ||
              process.exit !== undefined)
          : process.exit === undefined && process.stoppedBy === undefined,
    'Invalid execution process evidence.',
  )

export const executionSessionSnapshotSchema = z
  .object({
    session: sessionSchema.nullable(),
    commands: z.array(receiptSchema).max(maxExecutionCommands),
    processes: z.array(processSchema).max(maxExecutionCommands),
    delivery: receiptSchema.optional(),
    events: executionEventSummarySchema,
    savedSnapshots: z
      .array(projectSnapshotRecordSchema)
      .max(maxSessionSnapshots)
      .default([]),
    deferred: z.union([z.tuple([]), z.tuple([z.literal('model_tools')])]),
  })
  .strict()
  .refine((snapshot) => {
    const { session, commands, processes, delivery } = snapshot
    if (!session)
      return (
        commands.length === 0 &&
        processes.length === 0 &&
        snapshot.savedSnapshots.length === 0 &&
        snapshot.events.lastSequence === 0 &&
        snapshot.events.outputBytes === 0 &&
        snapshot.events.outputEvents === 0 &&
        snapshot.events.droppedBytes === 0 &&
        delivery === undefined
      )
    if (new Set(commands.map((command) => command.id)).size !== commands.length)
      return false
    if (
      new Set(processes.map((process) => process.id)).size !== processes.length
    )
      return false
    for (const item of [...commands, ...processes]) {
      if (
        item.sessionId !== session.id ||
        item.runtimeId !== session.runtimeId ||
        item.hostGeneration !== session.hostGeneration
      )
        return false
    }
    for (const command of commands) {
      if ((command.eventsThrough ?? 0) > snapshot.events.lastSequence)
        return false
      if (!session.runtime.capabilities.includes(command.operation.type))
        return false
      if (
        command.result?.type === 'save_snapshot' &&
        command.result.snapshotId !== command.id
      )
        return false
    }
    if (
      new Set(snapshot.savedSnapshots.map((item) => item.snapshotId)).size !==
      snapshot.savedSnapshots.length
    )
      return false
    for (const saved of snapshot.savedSnapshots) {
      const command = commands.find((item) => item.id === saved.snapshotId)
      if (
        saved.sessionId !== session.id ||
        saved.hostGeneration !== session.hostGeneration ||
        saved.runtimeId !== session.runtimeId ||
        !sameIdentity(saved.identity, session.identity) ||
        command?.operation.type !== 'save_snapshot' ||
        command.digest !== saved.commandDigest
      )
        return false
      if (command.state === 'succeeded') {
        if (saved.state !== 'ready' || command.result?.type !== 'save_snapshot')
          return false
        const result = command.result
        if (
          result.sha256 !== saved.sha256 ||
          result.byteLength !== saved.byteLength ||
          result.fileCount !== saved.fileCount ||
          result.workspaceVersion !== saved.workspaceVersion ||
          result.format !== saved.format
        )
          return false
      }
    }
    if (
      commands.some(
        (command) =>
          command.state === 'succeeded' &&
          command.operation.type === 'save_snapshot' &&
          !snapshot.savedSnapshots.some(
            (saved) =>
              saved.snapshotId === command.id && saved.state === 'ready',
          ),
      )
    )
      return false
    for (const process of processes) {
      const spawn = commands.find((command) => command.id === process.commandId)
      if (
        spawn?.state !== 'succeeded' ||
        spawn.result?.type !== 'spawn' ||
        spawn.processId !== process.id ||
        spawn.result.pid !== process.pid
      )
        return false
    }
    if (delivery) {
      if (
        !['ready', 'closing'].includes(session.status) ||
        !['dispatched', 'running'].includes(delivery.state)
      )
        return false
      const retained = commands.find((command) => command.id === delivery.id)
      if (!retained || JSON.stringify(retained) !== JSON.stringify(delivery))
        return false
    }
    return true
  }, 'Invalid execution snapshot relationships.')

export function parseExecutionSnapshot(
  value: unknown,
  identity: ExecutionIdentity,
): ExecutionSessionSnapshot {
  const parsed = executionSessionSnapshotSchema.safeParse(value)
  if (
    !parsed.success ||
    (parsed.data.session &&
      !sameIdentity(parsed.data.session.identity, identity))
  ) {
    throw new Error('The execution response is invalid for this conversation.')
  }
  return parsed.data
}

export const executionSessionHistorySchema = z
  .object({ sessions: z.array(sessionSchema).max(maxExecutionSessions) })
  .strict()
  .refine(
    ({ sessions }) =>
      new Set(sessions.map((session) => session.id)).size === sessions.length,
    'Execution session identities must be unique.',
  )

export function parseExecutionSessionHistory(
  value: unknown,
  identity: ExecutionIdentity,
): ExecutionSessionHistory {
  const parsed = executionSessionHistorySchema.safeParse(value)
  if (
    !parsed.success ||
    parsed.data.sessions.some(
      (session) => !sameIdentity(session.identity, identity),
    )
  )
    throw new Error('The execution history is invalid for this conversation.')
  return parsed.data
}

function sameIdentity(actual: ExecutionIdentity, expected: ExecutionIdentity) {
  return (
    actual.userId === expected.userId &&
    actual.workspaceId === expected.workspaceId &&
    actual.botId === expected.botId &&
    actual.conversationId === expected.conversationId
  )
}
