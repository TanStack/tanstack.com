import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'
import {
  maxScheduleEpoch,
  scheduleEpochSchema,
  scheduleTimezoneSchema,
} from '../core/schedules'

const localDateTimeSchema = z
  .string()
  .min(16)
  .max(23)
  .regex(
    /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,3})?)?$/,
    'Use a local ISO date and time without an offset, such as 2026-09-23T09:30.',
  )
  .refine((value) => {
    try {
      Temporal.PlainDateTime.from(value, { overflow: 'reject' })
      return true
    } catch {
      return false
    }
  }, 'Choose a valid calendar date and time.')

export const scheduleClockInputSchema = z
  .object({
    timezone: scheduleTimezoneSchema.describe(
      "The explicit IANA timezone for the requested time, such as America/Denver. Do not guess the user's timezone.",
    ),
    localDateTime: localDateTimeSchema
      .optional()
      .describe(
        'Use for a calendar date and local clock time: YYYY-MM-DDTHH:mm, optionally with seconds and up to three fractional digits. Do not include Z, an offset, or a timezone suffix. Repeated times use the earlier instant; skipped times are rejected. Supply this or delaySeconds, never both.',
      ),
    delaySeconds: z
      .number()
      .int()
      .min(1)
      .max(Math.floor(maxScheduleEpoch / 1000))
      .optional()
      .describe(
        'Use for an elapsed delay from the current server time, in positive whole seconds. The server computes the date. Supply this or localDateTime, never both.',
      ),
  })
  .strict()
  .refine(
    (input) =>
      (input.localDateTime !== undefined) !==
      (input.delaySeconds !== undefined),
    'Supply exactly one of localDateTime or delaySeconds.',
  )

function presentTime(at: number, timezone: string) {
  return {
    at,
    iso: new Date(at).toISOString(),
    local: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: timezone,
    }).format(at),
    timezone,
  }
}

/** Resolve wall time or elapsed seconds without asking a model to calculate epochs. */
export function resolveScheduleTime(input: unknown, now = Date.now()) {
  const args = scheduleClockInputSchema.parse(input)
  scheduleEpochSchema.parse(now)
  let at: number
  if (args.localDateTime !== undefined) {
    const wall = Temporal.PlainDateTime.from(args.localDateTime, {
      overflow: 'reject',
    })
    const zoned = wall.toZonedDateTime(args.timezone, {
      disambiguation: 'earlier',
    })
    if (!zoned.toPlainDateTime().equals(wall))
      throw new Error(
        'That local time is skipped by a clock change. Choose another time.',
      )
    at = zoned.epochMilliseconds
  } else {
    const delay = args.delaySeconds!
    if (delay > Math.floor((maxScheduleEpoch - now) / 1000))
      throw new Error('The requested delay exceeds the supported date range.')
    at = now + delay * 1000
  }
  scheduleEpochSchema.parse(at)
  return {
    now: presentTime(now, args.timezone),
    resolved: presentTime(at, args.timezone),
  }
}
