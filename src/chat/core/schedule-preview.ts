import { Temporal } from '@js-temporal/polyfill'
import {
  maxScheduleEpoch,
  scheduleEpochSchema,
  scheduleSpecSchema,
  type ScheduleSpec,
} from './schedules'

// Two weekly cycles plus the anchor and one extra day accommodate an omitted
// wall-clock occurrence, including IANA whole-day jumps. Work never scales with
// elapsed time since a prior occurrence. Exhaustion fails explicitly.
export const scheduleCalendarSearchLimit = 16

function search(spec: ScheduleSpec, boundary: number, direction: 1 | -1) {
  const { timezone, recurrence } = scheduleSpecSchema.parse(spec)
  scheduleEpochSchema.parse(boundary)
  if (recurrence.kind === 'once')
    return (
      direction === 1 ? recurrence.at > boundary : recurrence.at <= boundary
    )
      ? recurrence.at
      : undefined

  if (direction === 1 && boundary === maxScheduleEpoch) return undefined
  let date = Temporal.Instant.fromEpochMilliseconds(boundary)
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
  for (let searched = 0; searched < scheduleCalendarSearchLimit; searched++) {
    if (
      recurrence.kind === 'daily' ||
      recurrence.days.includes(date.dayOfWeek)
    ) {
      const wall = date.toPlainDateTime({
        hour: recurrence.hour,
        minute: recurrence.minute,
      })
      let candidate: Temporal.ZonedDateTime | undefined
      try {
        // Earlier chooses the first fold occurrence. For a gap, it shifts the
        // wall time; roundtripping rejects that shift instead of running late.
        // https://tc39.es/proposal-temporal/docs/timezone.html
        candidate = wall.toZonedDateTime(timezone, {
          disambiguation: 'earlier',
        })
      } catch (error) {
        // The zone was already resolved above and all wall fields are valid.
        // Conversion can still exceed the representable Instant endpoints.
        if (!(error instanceof RangeError)) throw error
      }
      if (candidate?.toPlainDateTime().equals(wall)) {
        const at = candidate.epochMilliseconds
        if (direction === -1 && at < 0) return undefined
        if (direction === 1 && at > maxScheduleEpoch) return undefined
        if (direction === 1 ? at > boundary : at <= boundary) return at
      }
    }
    try {
      date = date.add({ days: direction })
    } catch (error) {
      if (error instanceof RangeError) return undefined
      throw error
    }
  }
  throw new Error(
    'No schedule time was found within the bounded calendar search.',
  )
}

/** The next eligible instant strictly after afterMs. Gaps are skipped; folds
 * have one occurrence, the earlier instant. This never adds 24 UTC hours. */
export function nextScheduleTime(
  spec: ScheduleSpec,
  afterMs: number,
): number | undefined {
  return search(spec, afterMs, 1)
}

/** The most recent eligible instant at or before nowMs, without replaying a
 * missed range. The caller applies its persisted cursor and missed-run policy. */
export function latestScheduleTime(
  spec: ScheduleSpec,
  nowMs: number,
): number | undefined {
  return search(spec, nowMs, -1)
}
