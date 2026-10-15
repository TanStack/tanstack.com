import { z } from 'zod'
import { executionArtifact } from './execution-artifact'
import {
  executionProjectSchema,
  projectSnapshotMetadataSchema,
  type ExecutionProject,
  type ProjectSnapshotRecord,
} from './execution-project-snapshot'
export { executionArtifact } from './execution-artifact'
import {
  executionEventBatchSchema,
  maxExecutionEvents,
  type ExecutionEvent,
  type ExecutionEventSummary,
} from './execution-events'

export const executionLeaseMs = 60_000
export const maxExecutionSessions = 32
export const maxExecutionCommands = 32
export const maxExecutionPayloadBytes = 8192
export const maxExecutionResponseBytes = 1024 * 1024
const id = z.uuid()
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const taskId = z.string().min(1).max(128)
export const executionTaskIdentitySchema = z
  .object({
    runId: taskId,
    taskId,
    messageId: taskId,
  })
  .strict()
export const executionRunOriginSchema = executionTaskIdentitySchema
  .extend({
    kind: z.literal('run'),
    taskGeneration: version,
    modelPass: version,
    toolCallId: z.string().min(1).max(512),
  })
  .strict()
export const executionOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user') }).strict(),
  executionRunOriginSchema,
])
export const executionTaskBindingSchema = z
  .object({
    sessionId: id,
    hostGeneration: version,
    runtimeId: id,
  })
  .strict()
export type ExecutionRunOrigin = z.infer<typeof executionRunOriginSchema>
export type ExecutionCommandOrigin = z.infer<typeof executionOriginSchema>
export type ExecutionTaskBinding = z.infer<typeof executionTaskBindingSchema>
export type ExecutionTaskAuthority = z.infer<
  typeof executionTaskIdentitySchema
> & {
  taskGeneration: number
  active: boolean
  binding?: ExecutionTaskBinding
}
/** Command-filtered output keeps global sequence numbers, which can have gaps. */
export type ExecutionTaskOutput = {
  sessionId: string
  commandId: string
  after: number
  nextSequence: number
  events: ExecutionEvent[]
  hasMore: boolean
  outputBytes: number
  droppedBytes: number
}
const boundedPayload = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength <=
  maxExecutionPayloadBytes
const path = z
  .string()
  .max(512)
  .refine(
    (value) =>
      value.startsWith('/project/') &&
      !/[\u0000-\u001f\u007f\\]/.test(value) &&
      value
        .split('/')
        .slice(1)
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Use an absolute path within /project.',
  )
const cwd = z.union([z.literal('/project'), path]).default('/project')
const program = {
  command: z.string().min(1).max(128),
  args: z.array(z.string().max(512)).max(32),
  cwd,
  timeoutMs: z.number().int().min(1).max(30_000).default(30_000),
}
export const executionOperationSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('read_file'), path }).strict(),
    z
      .object({
        type: z.literal('write_file'),
        path,
        text: z.string().max(8192),
      })
      .strict(),
    z.object({ type: z.literal('run'), ...program }).strict(),
    z.object({ type: z.literal('spawn'), ...program }).strict(),
    z.object({ type: z.literal('stop_process'), processId: id }).strict(),
    z.object({ type: z.literal('close') }).strict(),
    z.object({ type: z.literal('save_snapshot') }).strict(),
    z
      .object({
        type: z.literal('preview_open'),
        processId: id,
        port: z.number().int().min(1).max(65535),
        path: z
          .string()
          .max(512)
          .regex(/^\/(?!\/)[^\u0000-\u001f\u007f\\]*$/)
          .default('/'),
      })
      .strict(),
    z.object({ type: z.literal('preview_inspect'), previewId: id }).strict(),
    z
      .object({
        type: z.literal('preview_click'),
        previewId: id,
        selector: z.string().min(1).max(256),
      })
      .strict(),
    z.object({ type: z.literal('preview_close'), previewId: id }).strict(),
  ])
  .refine(boundedPayload, 'Execution arguments exceed the byte limit.')
export type ExecutionOperation = z.infer<typeof executionOperationSchema>
export const executionCapabilities = [
  'read_file',
  'write_file',
  'run',
  'spawn',
  'stop_process',
  'close',
  'save_snapshot',
  'preview_open',
  'preview_inspect',
  'preview_click',
  'preview_close',
] as const
export const browserExecutionRuntime = {
  ...executionArtifact,
  capabilities: [...executionCapabilities],
}
export const executionRuntimeSchema = z
  .object({
    adapter: z.literal(executionArtifact.adapter),
    apiVersion: z.literal(executionArtifact.apiVersion),
    tarballSHA256: z.literal(executionArtifact.tarballSHA256),
    manifestSHA256: z.literal(executionArtifact.manifestSHA256),
    capabilities: z
      .array(z.enum(executionCapabilities))
      .min(1)
      .max(executionCapabilities.length)
      .refine(
        (items) => new Set(items).size === items.length,
        'Capabilities must be unique.',
      )
      .refine(
        (items) => items.includes('close'),
        'The runtime must support shutdown.',
      ),
  })
  .strict()
const signal = z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).nullable()
const exit = {
  exitCode: z.number().int().min(-128).max(255).nullable(),
  signal,
}
const previewState = {
  title: z.string().max(256),
  text: z.string().max(4096),
  truncated: z.boolean(),
}
export const executionResultSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('read_file'),
        text: z.string().max(8192),
        byteLength: z.number().int().nonnegative().max(8192),
        sha256: hash,
      })
      .strict(),
    z
      .object({
        type: z.literal('write_file'),
        byteLength: z.number().int().nonnegative().max(8192),
        sha256: hash,
      })
      .strict(),
    z
      .object({
        type: z.literal('run'),
        ...exit,
        durationMs: z.number().nonnegative().max(30_000),
      })
      .strict(),
    z
      .object({
        type: z.literal('spawn'),
        processId: id,
        pid: z.number().int().positive().max(2147483647),
        status: z.literal('running'),
      })
      .strict(),
    z
      .object({
        type: z.literal('stop_process'),
        processId: id,
        ...exit,
        outputDrained: z.literal(true),
        disposed: z.literal(true),
      })
      .strict(),
    z
      .object({
        type: z.literal('close'),
        shutdownAcknowledged: z.literal(true),
      })
      .strict(),
    projectSnapshotMetadataSchema.extend({ type: z.literal('save_snapshot') }),
    z
      .object({
        type: z.literal('preview_open'),
        previewId: id,
        processId: id,
        ...previewState,
      })
      .strict(),
    z
      .object({
        type: z.literal('preview_inspect'),
        previewId: id,
        ...previewState,
      })
      .strict(),
    z
      .object({
        type: z.literal('preview_click'),
        previewId: id,
        ...previewState,
      })
      .strict(),
    z
      .object({
        type: z.literal('preview_close'),
        previewId: id,
        closed: z.literal(true),
      })
      .strict(),
  ])
  .refine(boundedPayload, 'Execution result exceeds the byte limit.')
  .refine(
    (result) =>
      !('exitCode' in result) ||
      result.exitCode !== null ||
      result.signal !== null,
    'A terminal result needs an exit code or signal.',
  )
export type ExecutionResult = z.infer<typeof executionResultSchema>
const session = { sessionId: id }
const userCommand = { ...session, commandId: id, expectedVersion: version }
const host = {
  ...session,
  hostGeneration: version,
  ownerInstanceId: id,
  runtimeId: id,
  leaseProof: z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/),
}
export const executionSnapshotUploadSchema = z
  .object({
    ...host,
    commandId: id,
    digest: hash,
    snapshot: projectSnapshotMetadataSchema,
  })
  .strict()
  .refine(
    (value) => value.commandId === value.snapshot.snapshotId,
    'The snapshot must belong to its save command.',
  )
export type ExecutionSnapshotUpload = z.infer<
  typeof executionSnapshotUploadSchema
>
export const executionSessionCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create'),
      commandId: id,
      runtime: executionRuntimeSchema,
      project: executionProjectSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('claim'),
      ...userCommand,
      ownerInstanceId: id,
      runtimeId: id,
      leaseProof: host.leaseProof,
      runtime: executionRuntimeSchema,
    })
    .strict(),
  z.object({ type: z.literal('renew'), ...host }).strict(),
  z.object({ type: z.literal('dispatch'), ...host }).strict(),
  z
    .object({
      type: z.literal('append_events'),
      ...host,
      events: executionEventBatchSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('enqueue'),
      ...userCommand,
      operation: executionOperationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('acknowledge'),
      ...host,
      commandId: id,
      digest: hash,
      eventsThrough: generation.max(maxExecutionEvents).default(0),
      outcome: z.enum(['running', 'succeeded', 'failed']),
      result: executionResultSchema.optional(),
      error: z
        .object({
          code: z.string().min(1).max(80),
          message: z.string().min(1).max(512),
        })
        .strict()
        .optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (
        (value.outcome === 'succeeded') !== (value.result !== undefined) ||
        (value.outcome === 'failed') !== (value.error !== undefined)
      )
        context.addIssue({
          code: 'custom',
          message:
            'The acknowledgment must contain only the evidence for its outcome.',
        })
    }),
  z.object({ type: z.literal('abandon'), ...userCommand }).strict(),
])
export type ExecutionSessionCommand = z.infer<
  typeof executionSessionCommandSchema
>
export type ExecutionIdentity = {
  userId: string
  workspaceId: string
  botId: string
  conversationId: string
}
export const executionAuthoritySchema = z
  .object({ lifecycleGeneration: generation, membershipGeneration: generation })
  .strict()
export type ExecutionAuthority = z.infer<typeof executionAuthoritySchema>
export type ExecutionSession = {
  id: string
  identity: ExecutionIdentity
  version: number
  status:
    | 'awaiting_host'
    | 'ready'
    | 'disconnected'
    | 'closing'
    | 'closed'
    | 'abandoned'
  hostGeneration: number
  ownerInstanceId?: string
  runtimeId?: string
  leaseExpiresAt?: number
  authority: ExecutionAuthority
  runtime: z.infer<typeof executionRuntimeSchema>
  project: ExecutionProject
  createdAt: number
  updatedAt: number
}
export type ExecutionReceipt = {
  id: string
  sessionId: string
  digest: string
  hostGeneration: number
  runtimeId: string
  origin: ExecutionCommandOrigin
  operation: ExecutionOperation
  state:
    | 'queued'
    | 'dispatched'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'unknown'
  stopRequested: boolean
  createdAt: number
  dispatchedAt?: number
  completedAt?: number
  eventsThrough?: number
  processId?: string
  previewId?: string
  result?: ExecutionResult
  error?: { code: string; message: string }
}
export type ExecutionProcess = {
  id: string
  sessionId: string
  commandId: string
  hostGeneration: number
  runtimeId: string
  pid: number
  state: 'running' | 'stopped' | 'exited' | 'unknown'
  createdAt: number
  exit?: { exitCode: number | null; signal: string | null }
  stoppedBy?: 'process_receipt' | 'kernel_shutdown' | 'process_event'
}
export type ExecutionSessionSnapshot = {
  session: ExecutionSession | null
  commands: ExecutionReceipt[]
  processes: ExecutionProcess[]
  delivery?: ExecutionReceipt
  events: ExecutionEventSummary
  savedSnapshots: ProjectSnapshotRecord[]
  deferred: readonly [] | readonly ['model_tools']
}
/** Retained session metadata, newest first. Reading history grants no ownership. */
export type ExecutionSessionHistory = { sessions: ExecutionSession[] }
