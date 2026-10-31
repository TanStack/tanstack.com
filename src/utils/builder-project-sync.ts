import { z } from 'zod'
import {
  BUILDER_MESSAGE_ROLES,
  BUILDER_PROJECT_EVENT_TYPES,
  BUILDER_RUN_STATUSES,
} from '~/db/types'
import {
  builderProjectEventVersion,
  getBuilderProjectEventPayloadBytes,
} from './builder-project-events'
import { parseBuilderAiActivity } from './builder-ai-activity'
import { parseSharedExampleProject } from './example-project'
import { validateBuilderProjectSnapshot } from './builder-project-snapshot'

const maxMessageCharacters = 200_000
const maxCommandMessageBytes = 200 * 1024
const maxMessageParts = 200
export const builderProjectTranscriptImportMaxRequestBytes = 1_536 * 1024
export const builderProjectTranscriptImportMaxThreads = 50
export const builderProjectTranscriptImportMaxMessages = 1_000
export const builderProjectTranscriptImportMaxRuns = 500

export const builderProjectSyncSnapshotPageMaxRows = 100
export const builderProjectSyncSnapshotPageMaxBytes = 1_500 * 1024
export const builderProjectSyncSnapshotContinuationMaxCharacters = 512

export function getBuilderProjectSyncCommandRequestBytes(
  command: BuilderProjectSyncCommand,
) {
  return getSerializedBytes({ commands: [command] })
}

function getSerializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

const idSchema = z.uuid()
const timestampSchema = z.iso.datetime({ offset: true })
const jsonObjectSchema = z.record(z.string(), z.json())
const builderActivitySchema = jsonObjectSchema.transform((value, context) => {
  try {
    const normalized: unknown = JSON.parse(
      JSON.stringify(parseBuilderAiActivity(value)),
    )
    return jsonObjectSchema.parse(normalized)
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid run activity' })
    return z.NEVER
  }
})
const snapshotHashSchema = z.string().regex(/^[a-f0-9]{64}$/)

export const builderProjectSyncProjectSchema = z
  .object({
    id: idSchema,
    ownerId: idSchema,
    forkedFromId: idSchema.nullable(),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(1_000),
    snapshotHash: snapshotHashSchema,
    currentRevisionId: idSchema,
    currentRevisionNumber: z.number().int().positive(),
    lastEventSequence: z.number().int().nonnegative().safe(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

export const builderProjectSyncThreadSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    ownerId: idSchema,
    clientMutationId: idSchema,
    title: z.string().trim().min(1).max(160),
    lastMessagePosition: z.number().int().nonnegative().safe(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    archivedAt: timestampSchema.nullable(),
  })
  .strict()

export const builderProjectSyncMessageSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    ownerId: idSchema,
    threadId: idSchema,
    runId: idSchema.nullable(),
    clientMutationId: idSchema,
    role: z.enum(BUILDER_MESSAGE_ROLES),
    content: z.string().max(maxMessageCharacters),
    parts: z.array(jsonObjectSchema).max(maxMessageParts),
    position: z.number().int().positive().safe(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

export const builderProjectSyncRunSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    ownerId: idSchema,
    threadId: idSchema,
    clientMutationId: idSchema,
    status: z.enum(BUILDER_RUN_STATUSES),
    queueKind: z.enum(['queue', 'steer']),
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(100),
    baseRevisionId: idSchema.nullable(),
    resultRevisionId: idSchema.nullable(),
    leaseOwnerId: idSchema.nullable(),
    leaseFencingToken: z.number().int().nonnegative(),
    leaseExpiresAt: timestampSchema.nullable(),
    lastHeartbeatAt: timestampSchema.nullable(),
    activity: builderActivitySchema.nullable(),
    error: jsonObjectSchema.nullable(),
    startedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

export const builderProjectSyncEventSchema = z
  .object({
    version: z.literal(builderProjectEventVersion),
    id: idSchema,
    projectId: idSchema,
    ownerId: idSchema,
    sequence: z.number().int().positive().safe(),
    type: z.enum(BUILDER_PROJECT_EVENT_TYPES),
    payload: jsonObjectSchema,
    clientEventId: idSchema,
    clientMutationId: idSchema.nullable(),
    browserSessionId: idSchema.nullable(),
    threadId: idSchema.nullable(),
    messageId: idSchema.nullable(),
    runId: idSchema.nullable(),
    revisionId: idSchema.nullable(),
    occurredAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict()

const builderProjectSyncSnapshotContinuationTokenSchema = z
  .string()
  .min(1)
  .max(builderProjectSyncSnapshotContinuationMaxCharacters)
  .regex(/^[A-Za-z0-9_-]+$/)

export const builderProjectSyncSnapshotContinuationSchema = z
  .object({
    version: z.literal(1),
    projectId: idSchema,
    cursor: z.number().int().nonnegative().safe(),
    entity: z.enum(['threads', 'messages', 'runs']),
    afterId: idSchema.nullable(),
  })
  .strict()

export const builderProjectSyncSnapshotPageSchema = z
  .object({
    project: builderProjectSyncProjectSchema.nullable(),
    cursor: z.number().int().nonnegative().safe(),
    headCursor: z.number().int().nonnegative().safe(),
    threads: z
      .array(builderProjectSyncThreadSchema)
      .max(builderProjectSyncSnapshotPageMaxRows),
    messages: z
      .array(builderProjectSyncMessageSchema)
      .max(builderProjectSyncSnapshotPageMaxRows),
    runs: z
      .array(builderProjectSyncRunSchema)
      .max(builderProjectSyncSnapshotPageMaxRows),
    continuation: builderProjectSyncSnapshotContinuationTokenSchema.nullable(),
  })
  .strict()
  .superRefine((page, context) => {
    if (page.headCursor < page.cursor) {
      context.addIssue({
        code: 'custom',
        message: 'Builder project sync head is behind its snapshot barrier',
      })
    }
    if (
      getBuilderProjectSyncSnapshotPageBytes(page) >
      builderProjectSyncSnapshotPageMaxBytes
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Builder project sync snapshot page exceeds its byte limit',
      })
    }
    if (
      page.threads.length + page.messages.length + page.runs.length >
      builderProjectSyncSnapshotPageMaxRows
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Builder project sync snapshot page is too large',
      })
    }
  })

export const builderProjectSyncSnapshotSchema = z
  .object({
    project: builderProjectSyncProjectSchema,
    cursor: z.number().int().nonnegative().safe(),
    threads: z.array(builderProjectSyncThreadSchema),
    messages: z.array(builderProjectSyncMessageSchema),
    runs: z.array(builderProjectSyncRunSchema),
  })
  .strict()

const commandBaseSchema = z.object({
  clientMutationId: idSchema,
})

const sharedExampleProjectSchema = z.unknown().transform((value, context) => {
  try {
    const project = parseSharedExampleProject(value)
    validateBuilderProjectSnapshot(project)
    return project
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Builder project' })
    return z.NEVER
  }
})

const projectReviseCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('project.revise'),
    revisionId: idSchema,
    expectedRevisionNumber: z.number().int().positive(),
    project: sharedExampleProjectSchema,
  })
  .strict()

const threadCreateCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('thread.create'),
    thread: z
      .object({
        id: idSchema,
        title: z.string().trim().min(1).max(160),
        createdAt: timestampSchema.optional(),
      })
      .strict(),
  })
  .strict()

const messageInputSchema = z
  .object({
    id: idSchema,
    clientMutationId: idSchema,
    content: z.string().max(maxMessageCharacters),
    parts: z.array(jsonObjectSchema).max(maxMessageParts),
    createdAt: timestampSchema.optional(),
  })
  .strict()

const runEnqueueCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('run.enqueue'),
    run: z
      .object({
        id: idSchema,
        threadId: idSchema,
        queueKind: z.enum(['queue', 'steer']),
        provider: z.string().min(1).max(50),
        model: z.string().min(1).max(100),
      })
      .strict(),
    userMessage: messageInputSchema,
  })
  .strict()
  .superRefine((command, context) => {
    if (
      getBuilderProjectEventPayloadBytes({
        message: {
          id: command.userMessage.id,
          clientMutationId: command.userMessage.clientMutationId,
          content: command.userMessage.content,
          parts: command.userMessage.parts,
        },
      }) > maxCommandMessageBytes
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Message is too large',
        path: ['userMessage'],
      })
    }
  })

const runClaimCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('run.claim'),
    runId: idSchema,
    leaseOwnerId: idSchema,
  })
  .strict()

const runCancelCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('run.cancel'),
    runId: idSchema,
    browserSessionId: idSchema,
  })
  .strict()

const runHeartbeatCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('run.heartbeat'),
    runId: idSchema,
    leaseOwnerId: idSchema,
    leaseFencingToken: z.number().int().nonnegative(),
  })
  .strict()

const terminalRunStatusSchema = z.enum([
  'interrupted',
  'completed',
  'failed',
  'cancelled',
])

const assistantMessageInputSchema = messageInputSchema.extend({
  runId: idSchema,
})

const runRevisionInputSchema = z
  .object({
    id: idSchema,
    clientMutationId: idSchema,
    snapshotHash: snapshotHashSchema,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(1_000),
    expectedRevisionNumber: z.number().int().positive(),
  })
  .strict()

const runFinishCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('run.finish'),
    runId: idSchema,
    leaseOwnerId: idSchema,
    leaseFencingToken: z.number().int().nonnegative(),
    status: terminalRunStatusSchema,
    revision: runRevisionInputSchema.optional(),
    error: jsonObjectSchema.optional(),
    activity: builderActivitySchema.optional(),
    assistantMessage: assistantMessageInputSchema.optional(),
  })
  .strict()
  .superRefine((command, context) => {
    if (
      command.assistantMessage &&
      command.assistantMessage.runId !== command.runId
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Assistant messages must reference the completed run',
        path: ['assistantMessage', 'runId'],
      })
    }

    if (
      getBuilderProjectEventPayloadBytes({
        activity: command.activity ?? null,
        error: command.error ?? null,
      }) > maxCommandMessageBytes
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Run details are too large',
      })
    }

    if (command.activity) {
      try {
        const activity = parseBuilderAiActivity(command.activity)
        const expectedStatus =
          command.status === 'completed'
            ? 'complete'
            : command.status === 'failed'
              ? 'error'
              : 'stopped'
        if (
          activity.id !== command.runId ||
          activity.status !== expectedStatus
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Run activity does not match the terminal run',
            path: ['activity'],
          })
        }
      } catch {
        context.addIssue({
          code: 'custom',
          message: 'Invalid run activity',
          path: ['activity'],
        })
      }
    }

    if (
      command.assistantMessage &&
      getBuilderProjectEventPayloadBytes({
        message: {
          id: command.assistantMessage.id,
          clientMutationId: command.assistantMessage.clientMutationId,
          runId: command.assistantMessage.runId,
          content: command.assistantMessage.content,
          parts: command.assistantMessage.parts,
        },
      }) > maxCommandMessageBytes
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Message is too large',
        path: ['assistantMessage'],
      })
    }

    if (command.status === 'completed' && !command.assistantMessage) {
      context.addIssue({
        code: 'custom',
        message: 'Completed runs require an assistant message',
        path: ['assistantMessage'],
      })
    }

    if (command.status !== 'completed' && command.revision) {
      context.addIssue({
        code: 'custom',
        message: 'Only completed runs may create a project revision',
        path: ['revision'],
      })
    }

    if (command.status === 'failed' && !command.error) {
      context.addIssue({
        code: 'custom',
        message: 'Failed runs require an error',
        path: ['error'],
      })
    }
  })

const transcriptThreadInputSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(160),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    archivedAt: timestampSchema.nullable().optional(),
  })
  .strict()

const transcriptMessageInputSchema = z
  .object({
    id: idSchema,
    threadId: idSchema,
    runId: idSchema.optional(),
    role: z.enum(BUILDER_MESSAGE_ROLES),
    content: z.string().max(maxMessageCharacters),
    parts: z.array(jsonObjectSchema).max(maxMessageParts),
    position: z.number().int().positive().safe(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const transcriptRunInputSchema = z
  .object({
    id: idSchema,
    threadId: idSchema,
    status: terminalRunStatusSchema,
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(100),
    error: jsonObjectSchema.optional(),
    activity: builderActivitySchema.optional(),
    startedAt: timestampSchema.optional(),
    completedAt: timestampSchema,
  })
  .strict()

const transcriptImportCommandSchema = commandBaseSchema
  .extend({
    type: z.literal('transcript.import'),
    threads: z
      .array(transcriptThreadInputSchema)
      .max(builderProjectTranscriptImportMaxThreads),
    messages: z
      .array(transcriptMessageInputSchema)
      .max(builderProjectTranscriptImportMaxMessages),
    runs: z
      .array(transcriptRunInputSchema)
      .max(builderProjectTranscriptImportMaxRuns)
      .default([]),
  })
  .strict()
  .superRefine((command, context) => {
    if (
      getSerializedBytes({ commands: [command] }) >
      builderProjectTranscriptImportMaxRequestBytes
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Transcript import command is too large',
      })
    }

    const threadIds = new Set(command.threads.map((thread) => thread.id))
    const runThreadIds = new Map(
      command.runs.map((run) => [run.id, run.threadId]),
    )
    const runIds = new Set(runThreadIds.keys())
    const messageIds = new Set(command.messages.map((message) => message.id))

    if (threadIds.size !== command.threads.length) {
      context.addIssue({
        code: 'custom',
        message: 'Imported thread IDs must be unique',
        path: ['threads'],
      })
    }
    if (runIds.size !== command.runs.length) {
      context.addIssue({
        code: 'custom',
        message: 'Imported run IDs must be unique',
        path: ['runs'],
      })
    }
    if (messageIds.size !== command.messages.length) {
      context.addIssue({
        code: 'custom',
        message: 'Imported message IDs must be unique',
        path: ['messages'],
      })
    }

    const positions = new Set<string>()

    for (const [index, message] of command.messages.entries()) {
      if (
        getBuilderProjectEventPayloadBytes({
          message: {
            id: message.id,
            threadId: message.threadId,
            role: message.role,
            content: message.content,
            parts: message.parts,
            position: message.position,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          },
        }) > maxCommandMessageBytes
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Message is too large',
          path: ['messages', index],
        })
      }

      if (!threadIds.has(message.threadId)) {
        context.addIssue({
          code: 'custom',
          message: 'Imported messages must reference an imported thread',
          path: ['messages', index, 'threadId'],
        })
      }
      if (message.runId) {
        const runThreadId = runThreadIds.get(message.runId)
        if (!runThreadId) {
          context.addIssue({
            code: 'custom',
            message: 'Imported messages must reference an imported run',
            path: ['messages', index, 'runId'],
          })
        } else if (runThreadId !== message.threadId) {
          context.addIssue({
            code: 'custom',
            message: 'Imported messages and runs must use the same thread',
            path: ['messages', index, 'runId'],
          })
        }
      }

      const positionKey = `${message.threadId}:${message.position}`
      if (positions.has(positionKey)) {
        context.addIssue({
          code: 'custom',
          message: 'Imported message positions must be unique per thread',
          path: ['messages', index, 'position'],
        })
      }
      positions.add(positionKey)
    }

    for (const [index, run] of command.runs.entries()) {
      if (
        getBuilderProjectEventPayloadBytes({
          activity: run.activity ?? null,
          error: run.error ?? null,
        }) > maxCommandMessageBytes
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Run details are too large',
          path: ['runs', index],
        })
      }

      if (run.activity) {
        try {
          const activity = parseBuilderAiActivity(run.activity)
          const expectedStatus =
            run.status === 'completed'
              ? 'complete'
              : run.status === 'failed'
                ? 'error'
                : 'stopped'
          if (activity.id !== run.id || activity.status !== expectedStatus) {
            context.addIssue({
              code: 'custom',
              message: 'Run activity does not match the imported run',
              path: ['runs', index, 'activity'],
            })
          }
        } catch {
          context.addIssue({
            code: 'custom',
            message: 'Invalid run activity',
            path: ['runs', index, 'activity'],
          })
        }
      }

      if (!threadIds.has(run.threadId)) {
        context.addIssue({
          code: 'custom',
          message: 'Imported runs must reference an imported thread',
          path: ['runs', index, 'threadId'],
        })
      }
    }
  })

export const builderProjectSyncCommandSchema = z.discriminatedUnion('type', [
  projectReviseCommandSchema,
  threadCreateCommandSchema,
  runEnqueueCommandSchema,
  runClaimCommandSchema,
  runCancelCommandSchema,
  runHeartbeatCommandSchema,
  runFinishCommandSchema,
  transcriptImportCommandSchema,
])

export const builderProjectSyncRequestSchema = z
  .object({
    commands: z.array(builderProjectSyncCommandSchema).min(1).max(50),
  })
  .strict()
  .superRefine((request, context) => {
    const mutationIds = new Set(
      request.commands.map((command) => command.clientMutationId),
    )
    if (mutationIds.size !== request.commands.length) {
      context.addIssue({
        code: 'custom',
        message: 'Command mutation IDs must be unique',
        path: ['commands'],
      })
    }
  })

export const builderProjectSyncCommandResultSchema = z
  .object({
    clientMutationId: idSchema,
    sequence: z.number().int().nonnegative().safe(),
    events: z.array(builderProjectSyncEventSchema),
    leaseFencingToken: z.number().int().nonnegative().optional(),
  })
  .strict()

export const builderProjectSyncCommandRejectionSchema = z
  .object({
    clientMutationId: idSchema,
    rejected: z.literal(true),
    code: z.enum(['run-lease-invalid', 'project-revision-conflict']),
    message: z.string().trim().min(1).max(500),
    sequence: z.number().int().nonnegative().safe().optional(),
  })
  .strict()

export const builderProjectSyncCommandOutcomeSchema = z.union([
  builderProjectSyncCommandResultSchema,
  builderProjectSyncCommandRejectionSchema,
])

export const builderProjectSyncResponseSchema = z
  .object({
    cursor: z.number().int().nonnegative().safe(),
    results: z.array(builderProjectSyncCommandOutcomeSchema),
  })
  .strict()

export type BuilderProjectSyncProject = z.infer<
  typeof builderProjectSyncProjectSchema
>
export type BuilderProjectSyncThread = z.infer<
  typeof builderProjectSyncThreadSchema
>
export type BuilderProjectSyncMessage = z.infer<
  typeof builderProjectSyncMessageSchema
>
export type BuilderProjectSyncRun = z.infer<typeof builderProjectSyncRunSchema>
export type BuilderProjectSyncEvent = z.infer<
  typeof builderProjectSyncEventSchema
>
export type BuilderProjectSyncSnapshotContinuation = z.infer<
  typeof builderProjectSyncSnapshotContinuationSchema
>
export type BuilderProjectSyncSnapshotPage = z.infer<
  typeof builderProjectSyncSnapshotPageSchema
>
export type BuilderProjectSyncSnapshot = z.infer<
  typeof builderProjectSyncSnapshotSchema
>
export type BuilderProjectSyncCommand = z.infer<
  typeof builderProjectSyncCommandSchema
>
export type BuilderProjectSyncRequest = z.infer<
  typeof builderProjectSyncRequestSchema
>
export type BuilderProjectSyncCommandResult = z.infer<
  typeof builderProjectSyncCommandResultSchema
>
export type BuilderProjectSyncCommandRejection = z.infer<
  typeof builderProjectSyncCommandRejectionSchema
>
export type BuilderProjectSyncCommandOutcome = z.infer<
  typeof builderProjectSyncCommandOutcomeSchema
>
export type BuilderProjectSyncResponse = z.infer<
  typeof builderProjectSyncResponseSchema
>

export function isBuilderProjectSyncCommandRejection(
  outcome: BuilderProjectSyncCommandOutcome,
): outcome is BuilderProjectSyncCommandRejection {
  return 'rejected' in outcome
}

export function parseBuilderProjectSyncRequest(value: unknown) {
  return builderProjectSyncRequestSchema.parse(value)
}

export function parseBuilderProjectSyncSnapshot(value: unknown) {
  return builderProjectSyncSnapshotSchema.parse(value)
}

export function parseBuilderProjectSyncSnapshotPage(value: unknown) {
  return builderProjectSyncSnapshotPageSchema.parse(value)
}

export function getBuilderProjectSyncSnapshotPageBytes(value: unknown) {
  return getSerializedBytes(value)
}

export function takeBuilderProjectSyncSnapshotPageRows<TEntity>(
  rows: ReadonlyArray<TEntity>,
  createEmptyPage: (rows: ReadonlyArray<TEntity>) => unknown,
) {
  let pageBytes = getBuilderProjectSyncSnapshotPageBytes(createEmptyPage([]))
  const selected: Array<TEntity> = []

  for (const row of rows) {
    if (selected.length === builderProjectSyncSnapshotPageMaxRows) break
    const nextBytes =
      pageBytes +
      getBuilderProjectSyncSnapshotPageBytes(row) +
      (selected.length > 0 ? 1 : 0)
    if (nextBytes > builderProjectSyncSnapshotPageMaxBytes) {
      if (selected.length === 0) {
        throw new Error(
          'Builder project sync entity exceeds the snapshot page limit',
        )
      }
      break
    }
    selected.push(row)
    pageBytes = nextBytes
  }

  return selected
}

export function encodeBuilderProjectSyncSnapshotContinuation(
  continuation: BuilderProjectSyncSnapshotContinuation,
) {
  const value = JSON.stringify(
    builderProjectSyncSnapshotContinuationSchema.parse(continuation),
  )
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function parseBuilderProjectSyncSnapshotContinuation(value: string) {
  const token = builderProjectSyncSnapshotContinuationTokenSchema.parse(value)
  const padding = '='.repeat((4 - (token.length % 4)) % 4)
  const encoded = token.replace(/-/g, '+').replace(/_/g, '/') + padding
  return builderProjectSyncSnapshotContinuationSchema.parse(
    JSON.parse(atob(encoded)),
  )
}

export function parseBuilderProjectSyncEvent(value: unknown) {
  return builderProjectSyncEventSchema.parse(value)
}

export function parseBuilderProjectSyncResponse(value: unknown) {
  return builderProjectSyncResponseSchema.parse(value)
}
