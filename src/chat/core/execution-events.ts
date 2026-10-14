import { z } from 'zod'

export const maxExecutionEventChunkBytes = 16_384
export const maxExecutionEventBatchBytes = 65_536
export const maxExecutionEventBatchCount = 64
export const maxExecutionOutputBytes = 1024 * 1024
export const maxExecutionOutputEvents = 4096
// Output cannot consume the slots reserved for gaps and process exits.
export const maxExecutionEvents = maxExecutionOutputEvents + 64
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const sequence = integer.min(1).max(maxExecutionEvents)
const hash = z.string().regex(/^[a-f0-9]{64}$/)

export function encodeExecutionBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeExecutionBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  if (btoa(binary) !== value) throw new Error('Noncanonical execution bytes.')
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const bytes = z
  .string()
  .min(4)
  .max(21_848)
  .refine((value) => {
    try {
      const decoded = decodeExecutionBytes(value)
      return decoded.length > 0 && decoded.length <= maxExecutionEventChunkBytes
    } catch {
      return false
    }
  }, 'Invalid execution output bytes.')
const target = {
  sequence,
  commandId: z.uuid(),
  digest: hash,
}
export const executionEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...target,
      type: z.literal('output'),
      processId: z.uuid().optional(),
      stream: z.enum(['stdout', 'stderr']),
      dataBase64: bytes,
    })
    .strict(),
  z
    .object({
      ...target,
      type: z.literal('output-gap'),
      processId: z.uuid().optional(),
      droppedBytes: integer.min(1),
    })
    .strict(),
  z
    .object({
      ...target,
      type: z.literal('process-exit'),
      processId: z.uuid(),
      exitCode: z.number().int().min(-128).max(255).nullable(),
      signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).nullable(),
      outputDrained: z.literal(true),
    })
    .strict()
    .refine((event) => event.exitCode !== null || event.signal !== null),
])
export type ExecutionEvent = z.infer<typeof executionEventSchema>
export const executionEventBatchSchema = z
  .array(executionEventSchema)
  .min(1)
  .max(maxExecutionEventBatchCount)
  .refine(
    (events) =>
      events.every(
        (event, index) =>
          index === 0 || event.sequence === events[index - 1].sequence + 1,
      ),
    'Execution events must be consecutive.',
  )
  .refine((events) => {
    try {
      return executionEventsByteLength(events) <= maxExecutionEventBatchBytes
    } catch {
      return false
    }
  }, 'Execution output batch exceeds its byte limit.')

export function executionEventsByteLength(events: readonly ExecutionEvent[]) {
  return events.reduce(
    (total, event) =>
      total +
      (event.type === 'output'
        ? decodeExecutionBytes(event.dataBase64).length
        : 0),
    0,
  )
}

export const executionEventSummarySchema = z
  .object({
    lastSequence: integer.max(maxExecutionEvents),
    outputBytes: integer.max(maxExecutionOutputBytes),
    outputEvents: integer.max(maxExecutionOutputEvents),
    droppedBytes: integer,
  })
  .strict()
  .refine(
    (summary) =>
      summary.outputEvents <= summary.lastSequence &&
      summary.outputBytes >= summary.outputEvents &&
      summary.outputBytes <=
        summary.outputEvents * maxExecutionEventChunkBytes &&
      (summary.droppedBytes === 0 ||
        summary.lastSequence > summary.outputEvents),
    'Invalid execution output totals.',
  )
export type ExecutionEventSummary = z.infer<typeof executionEventSummarySchema>
export const emptyExecutionEventSummary = (): ExecutionEventSummary => ({
  lastSequence: 0,
  outputBytes: 0,
  outputEvents: 0,
  droppedBytes: 0,
})
export const executionEventReadSchema = z
  .object({
    sessionId: z.uuid(),
    after: integer.max(maxExecutionEvents),
  })
  .strict()
export type ExecutionEventRead = z.infer<typeof executionEventReadSchema>
export const executionEventPageSchema = z
  .object({
    sessionId: z.uuid(),
    hostGeneration: integer,
    runtimeId: z.uuid().optional(),
    after: integer.max(maxExecutionEvents),
    nextSequence: integer.max(maxExecutionEvents),
    summary: executionEventSummarySchema,
    events: z.array(executionEventSchema).max(maxExecutionEventBatchCount),
    hasMore: z.boolean(),
  })
  .strict()
  .refine((page) => {
    if (page.hostGeneration > 0 !== (page.runtimeId !== undefined)) return false
    if (page.after > page.summary.lastSequence) return false
    if (
      page.events.some(
        (event, index) => event.sequence !== page.after + index + 1,
      )
    )
      return false
    const next = page.events.at(-1)?.sequence ?? page.after
    let bytes: number
    try {
      bytes = executionEventsByteLength(page.events)
    } catch {
      return false
    }
    return (
      page.nextSequence === next &&
      next <= page.summary.lastSequence &&
      page.hasMore === next < page.summary.lastSequence &&
      (!page.hasMore || page.events.length > 0) &&
      bytes <= maxExecutionEventBatchBytes &&
      bytes <= page.summary.outputBytes &&
      page.events.filter((event) => event.type === 'output').length <=
        page.summary.outputEvents &&
      page.events.reduce(
        (total, event) =>
          total + (event.type === 'output-gap' ? event.droppedBytes : 0),
        0,
      ) <= page.summary.droppedBytes
    )
  }, 'Invalid execution event page.')
export type ExecutionEventPage = z.infer<typeof executionEventPageSchema>
