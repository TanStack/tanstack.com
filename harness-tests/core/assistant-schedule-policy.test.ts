import { describe, expect, it } from 'vitest'
import type {
  ScheduleCommand,
  ScheduleRecord,
  ScheduleSnapshot,
  ScheduleSpec,
} from '../../src/chat/core/schedules'
import { decideAssistantSchedule } from '../../src/chat/server/assistant-schedule-policy'
import { ScheduleStoreError } from '../../src/chat/server/schedules'

const commandId = '3c85b390-0e5e-4d10-aa29-7e37e35dbf88'
const scheduleId = '0e9cbbae-5ea3-4be2-bf7e-f311cf89c05d'
const otherId = '63132f7f-22c0-4ce3-94c4-b64f0c564993'
const timezone = 'America/Denver'
const otherTimezone = 'Europe/London'

function spec(zone = timezone): ScheduleSpec {
  return {
    name: 'Morning review',
    objective: 'Review new messages.',
    timezone: zone,
    recurrence: { kind: 'daily', hour: 9, minute: 0 },
  }
}

function record(overrides: Partial<ScheduleRecord> = {}): ScheduleRecord {
  return {
    id: scheduleId,
    identity: {
      workspaceId: 'workspace',
      userId: 'viewer',
      botId: 'assistant',
      conversationId: 'exact:conversation',
    },
    revision: 3,
    status: 'active',
    spec: spec(),
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

function snapshot(...schedules: ScheduleRecord[]): ScheduleSnapshot {
  return { schedules, occurrences: [] }
}

function create(zone = timezone): ScheduleCommand {
  return { type: 'create', commandId, spec: spec(zone) }
}

function update(zone = timezone, revision = 3): ScheduleCommand {
  return {
    type: 'update',
    commandId,
    id: scheduleId,
    revision,
    spec: spec(zone),
  }
}

function expectRejection(action: () => unknown, status: 404 | 409) {
  expect(action).toThrow(ScheduleStoreError)
  expect(action).toThrow(expect.objectContaining({ status }))
}

describe('assistant schedule timezone policy', () => {
  it('requires review when no account timezone has been saved', () => {
    expect(decideAssistantSchedule(create(), snapshot(), null)).toEqual({
      kind: 'review',
      reason: 'timezone-unset',
    })
  })

  it('allows creation in the exact saved account timezone', () => {
    expect(decideAssistantSchedule(create(), snapshot(), timezone)).toEqual({
      kind: 'direct',
    })
  })

  it('reviews a different creation timezone and identifies the saved timezone', () => {
    expect(
      decideAssistantSchedule(create(otherTimezone), snapshot(), timezone),
    ).toEqual({
      kind: 'review',
      reason: 'timezone-change',
      previousTimezone: timezone,
    })
  })

  it.each([null, otherTimezone])(
    'keeps an existing schedule timezone when the account preference is %s',
    (accountTimezone) => {
      const current = snapshot(record())
      const before = structuredClone(current)
      expect(
        decideAssistantSchedule(update(), current, accountTimezone),
      ).toEqual({ kind: 'direct' })
      expect(current).toEqual(before)
    },
  )

  it('uses the saved timezone of a paused update target too', () => {
    expect(
      decideAssistantSchedule(
        update(),
        snapshot(record({ status: 'paused' })),
        otherTimezone,
      ),
    ).toEqual({ kind: 'direct' })
  })

  it.each([null, otherTimezone])(
    'reviews an update timezone change even when the account preference is %s',
    (accountTimezone) => {
      expect(
        decideAssistantSchedule(
          update(otherTimezone),
          snapshot(record()),
          accountTimezone,
        ),
      ).toEqual({
        kind: 'review',
        reason: 'timezone-change',
        previousTimezone: timezone,
      })
    },
  )

  it('rejects a missing update target even if another schedule matches the timezone', () => {
    expectRejection(
      () =>
        decideAssistantSchedule(
          update(),
          snapshot(record({ id: otherId })),
          timezone,
        ),
      404,
    )
  })

  it('rejects a stale update before accepting its unchanged timezone', () => {
    expectRejection(
      () =>
        decideAssistantSchedule(
          update(timezone, 2),
          snapshot(record()),
          timezone,
        ),
      409,
    )
  })

  it('rejects a deleted update target even if its revision and timezone match', () => {
    expectRejection(
      () =>
        decideAssistantSchedule(
          update(),
          snapshot(record({ status: 'deleted' })),
          timezone,
        ),
      404,
    )
  })

  const otherCommands: ScheduleCommand[] = [
    ...(['pause', 'resume', 'delete', 'run-now'] as const).map((type) => ({
      type,
      commandId,
      id: scheduleId,
      revision: 3,
    })),
    { type: 'cancel-run', commandId, occurrenceId: otherId },
  ]

  it.each(otherCommands)(
    'leaves $type to the ordinary command validation without timezone review',
    (command) => {
      expect(decideAssistantSchedule(command, snapshot(), null)).toEqual({
        kind: 'direct',
      })
    },
  )
})
