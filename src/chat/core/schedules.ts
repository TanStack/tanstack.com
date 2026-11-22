import { z } from 'zod'
import { Temporal } from '@js-temporal/polyfill'
import {
  type ConversationRun,
  conversationRunIdentitySchema,
  conversationRunStatusSchema,
} from './conversation-runs'
import { referenceInputsSchema } from './message-references'
import { runModelSchema } from './run-model'

// The shared nonnegative Date/Temporal millisecond range, not any safe integer.
export const maxScheduleEpoch = 8_640_000_000_000_000
export const scheduleEpochSchema = z.number().int().min(0).max(maxScheduleEpoch)
const uuid = z.string().uuid()
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)

/** Named zones use the host's IANA data. Numeric offsets are not recurrence zones.
 * Preserve recognized aliases rather than rewriting a saved timezone identifier. */
export const scheduleTimezoneSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/)
  .refine((timezone) => {
    try {
      // Intl alone accepts extra ICU identifiers such as PST that Temporal
      // correctly rejects. Validate with the same named-zone rules as execution.
      Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timezone)
      return true
    } catch {
      return false
    }
  }, 'Choose a recognized IANA timezone, such as America/Denver.')

const clock = {
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
}
export const scheduleRecurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), at: scheduleEpochSchema }).strict(),
  z.object({ kind: z.literal('daily'), ...clock }).strict(),
  z
    .object({
      kind: z.literal('weekly'),
      days: z
        .array(z.number().int().min(1).max(7))
        .min(1)
        .max(7)
        .refine(
          (days) => new Set(days).size === days.length,
          'Choose each day only once.',
        ),
      ...clock,
    })
    .strict(),
])
export const scheduleSpecSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    objective: z.string().trim().min(1).max(12000),
    timezone: scheduleTimezoneSchema,
    recurrence: scheduleRecurrenceSchema,
    runModel: runModelSchema.optional(),
    references: referenceInputsSchema.optional(),
  })
  .strict()
export type ScheduleSpec = z.infer<typeof scheduleSpecSchema>

const target = { commandId: uuid, id: uuid, revision }
export const scheduleCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create'),
      commandId: uuid,
      spec: scheduleSpecSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('update'), ...target, spec: scheduleSpecSchema })
    .strict(),
  z.object({ type: z.literal('pause'), ...target }).strict(),
  z.object({ type: z.literal('resume'), ...target }).strict(),
  z.object({ type: z.literal('delete'), ...target }).strict(),
  z.object({ type: z.literal('run-now'), ...target }).strict(),
  z
    .object({
      type: z.literal('cancel-run'),
      commandId: uuid,
      occurrenceId: uuid,
    })
    .strict(),
])
export type ScheduleCommand = z.infer<typeof scheduleCommandSchema>

export const scheduleRecordSchema = z
  .object({
    id: uuid,
    identity: conversationRunIdentitySchema,
    revision,
    status: z.enum(['active', 'paused', 'deleted']),
    spec: scheduleSpecSchema,
    createdAt: scheduleEpochSchema,
    updatedAt: scheduleEpochSchema,
    nextDueAt: scheduleEpochSchema.optional(),
    pauseReason: z.string().min(1).max(240).optional(),
  })
  .strict()
export type ScheduleRecord = z.infer<typeof scheduleRecordSchema>

export const scheduleOccurrenceSchema = z
  .object({
    id: uuid,
    scheduleId: uuid,
    revision,
    source: z.enum(['timer', 'manual']),
    dueAt: scheduleEpochSchema,
    createdAt: scheduleEpochSchema,
    updatedAt: scheduleEpochSchema,
    status: z.enum([
      'pending',
      ...conversationRunStatusSchema.options,
      'skipped',
    ]),
    runId: z.string().min(1).max(128).optional(),
    /** Derived from the matching started run, not from queue admission. */
    runMessageId: z.string().min(1).max(128).optional(),
    reason: z.string().min(1).max(240).optional(),
    retryAt: scheduleEpochSchema.optional(),
  })
  .strict()
export type ScheduleOccurrence = z.infer<typeof scheduleOccurrenceSchema>

export const scheduleSnapshotSchema = z
  .object({
    schedules: z.array(scheduleRecordSchema),
    occurrences: z.array(scheduleOccurrenceSchema),
  })
  .strict()
export type ScheduleSnapshot = z.infer<typeof scheduleSnapshotSchema>

export function scheduledRunMessageId(
  occurrence: ScheduleOccurrence,
  runs: ConversationRun[],
) {
  const run = runs.find((item) => item.id === occurrence.runId)
  if (
    !run ||
    run.startedAt === undefined ||
    run.origin.kind !== 'schedule' ||
    run.origin.occurrenceId !== occurrence.id ||
    run.origin.scheduleId !== occurrence.scheduleId ||
    run.origin.revision !== occurrence.revision
  )
    return undefined
  return run.origin.occurrenceId
}
