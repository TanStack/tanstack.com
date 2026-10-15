import type { ScheduleCommand, ScheduleSnapshot } from '../core/schedules'
import { ScheduleStoreError } from './schedules'

/** Model arguments cannot establish a user's timezone preference. */
export function decideAssistantSchedule(
  command: ScheduleCommand,
  snapshot: ScheduleSnapshot,
  accountTimezone: string | null,
):
  | { kind: 'direct' }
  | {
      kind: 'review'
      reason: 'timezone-unset' | 'timezone-change'
      previousTimezone?: string
    } {
  if (command.type !== 'create' && command.type !== 'update')
    return { kind: 'direct' }
  let trusted = accountTimezone
  if (command.type === 'update') {
    const existing = snapshot.schedules.find(
      (schedule) => schedule.id === command.id && schedule.status !== 'deleted',
    )
    if (!existing) throw new ScheduleStoreError('Schedule not found.', 404)
    if (existing.revision !== command.revision)
      throw new ScheduleStoreError(
        'This schedule changed. Read its current settings before editing it.',
        409,
      )
    trusted = existing.spec.timezone
  }
  if (trusted === command.spec.timezone) return { kind: 'direct' }
  return trusted === null
    ? { kind: 'review', reason: 'timezone-unset' }
    : { kind: 'review', reason: 'timezone-change', previousTimezone: trusted }
}
