import { z } from 'zod'
import {
  executionProjectSchema,
  maxProjectSnapshotBytes,
} from './execution-project-snapshot'
import {
  executionOperationSchema,
  executionOriginSchema,
  executionResultSchema,
  executionRuntimeSchema,
} from './execution-sessions'

const id = z.uuid()
const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const generation = counter.positive()
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const nonce = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)
const snapshotBytes = z
  .instanceof(Uint8Array)
  .refine(
    (bytes) =>
      bytes.byteLength > 12 && bytes.byteLength <= maxProjectSnapshotBytes,
    'The project snapshot exceeds its byte limit.',
  )
export const maxExecutionOutputChunkBytes = 16 * 1024
export const executionBridgeErrorSchema = z
  .object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(512),
  })
  .strict()
export type ExecutionBridgeFailure = z.infer<typeof executionBridgeErrorSchema>

// This is a committed delivery, never a lease or a request to enqueue work.
export const executionDeliverySchema = z
  .object({
    id,
    sessionId: id,
    digest,
    hostGeneration: generation,
    runtimeId: id,
    origin: executionOriginSchema,
    operation: executionOperationSchema,
    state: z.enum(['dispatched', 'running', 'unknown']),
    stopRequested: z.boolean(),
    createdAt: counter,
    dispatchedAt: counter,
    processId: id.optional(),
    previewId: id.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.state === 'unknown' &&
      (!value.stopRequested || value.origin.kind !== 'run')
    )
      context.addIssue({
        code: 'custom',
        message:
          'Only a stopped model command can be delivered with an unknown outcome.',
      })
    if (
      (value.operation.type === 'spawn') !== (value.processId !== undefined) ||
      (value.operation.type === 'preview_open') !==
        (value.previewId !== undefined)
    )
      context.addIssue({
        code: 'custom',
        message: 'The delivery must contain only its reserved handle.',
      })
    if (value.dispatchedAt < value.createdAt)
      context.addIssue({
        code: 'custom',
        message: 'The dispatch time is invalid.',
      })
  })
export type ExecutionDelivery = z.infer<typeof executionDeliverySchema>
export const executionStopDeliverySchema = executionDeliverySchema.refine(
  (value) => value.origin.kind === 'run' && value.stopRequested,
  'A stop control requires the exact stopped model command.',
)

export const executionConnectSchema = z
  .object({
    type: z.literal('gum-execution-connect'),
    version: z.literal(1),
    nonce,
    sessionId: id,
    hostGeneration: generation,
    runtimeId: id,
    project: executionProjectSchema,
    snapshotBytes: snapshotBytes.optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.project.source === 'snapshot') ===
      (value.snapshotBytes !== undefined),
    'Only a snapshot project may supply saved bytes.',
  )
export type ExecutionBridgeConnect = z.infer<typeof executionConnectSchema>

const outcomeIdentity = { commandId: id, digest }
const succeeded = z
  .object({
    ...outcomeIdentity,
    outcome: z.literal('succeeded'),
    result: executionResultSchema,
  })
  .strict()
const failed = z
  .object({
    ...outcomeIdentity,
    outcome: z.literal('failed'),
    error: executionBridgeErrorSchema,
  })
  .strict()
const unknown = z
  .object({
    ...outcomeIdentity,
    outcome: z.literal('unknown'),
    error: executionBridgeErrorSchema,
  })
  .strict()
export const executionCommandOutcomeSchema = z.discriminatedUnion('outcome', [
  succeeded,
  failed,
  unknown,
])
export type ExecutionCommandOutcome = z.infer<
  typeof executionCommandOutcomeSchema
>
export const executionShutdownOutcomeSchema = z.union([
  z.object({ confirmed: z.literal(true) }).strict(),
  z
    .object({ confirmed: z.literal(false), error: executionBridgeErrorSchema })
    .strict(),
])
export type ExecutionShutdownOutcome = z.infer<
  typeof executionShutdownOutcomeSchema
>

export const executionBridgeRequestSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('stop_command'),
      requestId: id,
      delivery: executionStopDeliverySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('execute'),
      requestId: id,
      delivery: executionDeliverySchema,
    })
    .strict(),
  z.object({ type: z.literal('shutdown'), requestId: id }).strict(),
  z
    .object({
      type: z.literal('read_snapshot'),
      requestId: id,
      commandId: id,
      digest,
    })
    .strict(),
])
export type ExecutionBridgeRequest = z.infer<
  typeof executionBridgeRequestSchema
>

const resultEnvelope = { type: z.literal('result'), requestId: id }
const shutdownEnvelope = { type: z.literal('shutdown-result'), requestId: id }
export const executionBridgeResponseSchema = z.union([
  z
    .object({
      type: z.literal('snapshot_data'),
      requestId: id,
      commandId: id,
      digest,
      bytes: snapshotBytes,
    })
    .strict(),
  z
    .object({
      type: z.literal('ready'),
      version: z.literal(1),
      nonce,
      runtime: executionRuntimeSchema,
    })
    .strict(),
  succeeded.extend(resultEnvelope),
  failed.extend(resultEnvelope),
  unknown.extend(resultEnvelope),
  z.object({ ...shutdownEnvelope, confirmed: z.literal(true) }).strict(),
  z
    .object({
      ...shutdownEnvelope,
      confirmed: z.literal(false),
      error: executionBridgeErrorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('rejected'),
      requestId: id,
      error: executionBridgeErrorSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('fault'), error: executionBridgeErrorSchema })
    .strict(),
  z
    .object({
      type: z.literal('output'),
      commandId: id,
      processId: id.optional(),
      sequence: counter,
      stream: z.enum(['stdout', 'stderr']),
      bytes: z
        .instanceof(Uint8Array)
        .refine(
          (bytes) =>
            bytes.byteLength > 0 &&
            bytes.byteLength <= maxExecutionOutputChunkBytes,
          'The output chunk exceeds its byte limit.',
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal('output-gap'),
      commandId: id,
      processId: id.optional(),
      droppedBytes: counter.positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal('process-exit'),
      commandId: id,
      processId: id,
      exitCode: z.number().int().min(-128).max(255).nullable(),
      signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).nullable(),
      outputDrained: z.literal(true),
    })
    .strict()
    .refine(
      (value) => value.exitCode !== null || value.signal !== null,
      'An exit needs a code or signal.',
    ),
])
export type ExecutionBridgeResponse = z.infer<
  typeof executionBridgeResponseSchema
>
