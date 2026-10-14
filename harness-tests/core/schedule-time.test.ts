import { describe, expect, it, vi } from 'vitest'
import { Temporal } from '@js-temporal/polyfill'
import {
  maxScheduleEpoch,
  scheduleCommandSchema,
  scheduleSnapshotSchema,
  scheduleSpecSchema,
  type ScheduleSpec,
} from '../../src/chat/core/schedules'
import {
  latestScheduleTime,
  nextScheduleTime,
  scheduleCalendarSearchLimit,
} from '../../src/chat/server/schedule-time'

const epoch = (iso: string) => Date.parse(iso)
const daily = (
  timezone = 'America/New_York',
  hour = 9,
  minute = 0,
): ScheduleSpec => ({
  name: 'Morning summary',
  objective: 'Summarize new messages.',
  timezone,
  recurrence: { kind: 'daily', hour, minute },
})
const weekly = (
  timezone: string,
  days: number[],
  hour: number,
  minute = 0,
): ScheduleSpec => ({
  ...daily(timezone),
  recurrence: { kind: 'weekly', days, hour, minute },
})
const id = '32455eab-b12b-40d1-b86b-22fbe11b17b9'
const commandId = 'f0f2b7f4-f542-4be5-9a2e-2a5a21dd338b'

describe('calendar recurrence', () => {
  it('uses an exclusive next boundary and inclusive latest boundary', () => {
    const spec = daily('UTC')
    const due = epoch('2026-09-23T09:00:00Z')
    expect(nextScheduleTime(spec, due - 1)).toBe(due)
    expect(nextScheduleTime(spec, due)).toBe(epoch('2026-09-24T09:00:00Z'))
    expect(latestScheduleTime(spec, due)).toBe(due)
    expect(latestScheduleTime(spec, due - 1)).toBe(
      epoch('2026-09-22T09:00:00Z'),
    )
  })

  it('preserves wall-clock intent across 23-hour and 25-hour days', () => {
    const spec = daily()
    const beforeSpring = epoch('2026-03-07T14:00:00Z')
    const afterSpring = nextScheduleTime(spec, beforeSpring)!
    expect(afterSpring).toBe(epoch('2026-03-08T13:00:00Z'))
    expect(afterSpring - beforeSpring).toBe(23 * 60 * 60 * 1000)
    const beforeFall = epoch('2026-10-31T13:00:00Z')
    const afterFall = nextScheduleTime(spec, beforeFall)!
    expect(afterFall).toBe(epoch('2026-11-01T14:00:00Z'))
    expect(afterFall - beforeFall).toBe(25 * 60 * 60 * 1000)
  })

  it('skips a nonexistent daily spring-forward time in both directions', () => {
    const spec = daily('America/New_York', 2, 30)
    expect(nextScheduleTime(spec, epoch('2026-03-07T07:30:00Z'))).toBe(
      epoch('2026-03-09T06:30:00Z'),
    )
    expect(latestScheduleTime(spec, epoch('2026-03-08T16:00:00Z'))).toBe(
      epoch('2026-03-07T07:30:00Z'),
    )
  })

  it('runs a repeated time only at the earlier fold instant', () => {
    const spec = daily('America/New_York', 1, 30)
    const first = epoch('2026-11-01T05:30:00Z')
    expect(nextScheduleTime(spec, first - 1)).toBe(first)
    expect(nextScheduleTime(spec, first)).toBe(epoch('2026-11-02T06:30:00Z'))
    expect(latestScheduleTime(spec, epoch('2026-11-01T06:30:00Z'))).toBe(first)
    expect(latestScheduleTime(spec, epoch('2026-11-01T06:10:00Z'))).toBe(first)
  })

  it('handles Lord Howe half-hour gaps and folds without assuming a one-hour shift', () => {
    const gap = daily('Australia/Lord_Howe', 2, 15)
    expect(nextScheduleTime(gap, epoch('2026-10-02T15:45:00Z'))).toBe(
      epoch('2026-10-04T15:15:00Z'),
    )
    expect(latestScheduleTime(gap, epoch('2026-10-03T18:00:00Z'))).toBe(
      epoch('2026-10-02T15:45:00Z'),
    )
    const fold = daily('Australia/Lord_Howe', 1, 45)
    expect(nextScheduleTime(fold, epoch('2026-04-04T14:45:00Z'))).toBe(
      epoch('2026-04-05T15:15:00Z'),
    )
    expect(latestScheduleTime(fold, epoch('2026-04-04T15:20:00Z'))).toBe(
      epoch('2026-04-04T14:45:00Z'),
    )
  })

  it('supports a quarter-hour base offset and leap-day calendar arithmetic', () => {
    const spec = daily('Asia/Kathmandu', 9, 15)
    expect(nextScheduleTime(spec, epoch('2028-02-28T03:30:00Z'))).toBe(
      epoch('2028-02-29T03:30:00Z'),
    )
    expect(nextScheduleTime(spec, epoch('2028-02-29T03:30:00Z'))).toBe(
      epoch('2028-03-01T03:30:00Z'),
    )
  })

  it('skips Samoa’s missing local date without shifting the requested time', () => {
    const spec = daily('Pacific/Apia', 9)
    const prior = epoch('2011-12-29T19:00:00Z')
    const following = epoch('2011-12-30T19:00:00Z')
    expect(nextScheduleTime(spec, prior)).toBe(following)
    expect(latestScheduleTime(spec, following - 1)).toBe(prior)
  })

  it('uses ISO weekdays and finds the selected days across a year boundary', () => {
    const spec = weekly('UTC', [7, 1], 0)
    expect(nextScheduleTime(spec, epoch('2026-12-31T23:59:59Z'))).toBe(
      epoch('2027-01-03T00:00:00Z'),
    )
    expect(nextScheduleTime(spec, epoch('2027-01-03T00:00:00Z'))).toBe(
      epoch('2027-01-04T00:00:00Z'),
    )
    expect(latestScheduleTime(spec, epoch('2027-01-02T23:59:59Z'))).toBe(
      epoch('2026-12-28T00:00:00Z'),
    )
  })

  it('skips a weekly selected day when its local time does not exist', () => {
    const spec = weekly('America/New_York', [7], 2, 30)
    expect(nextScheduleTime(spec, epoch('2026-03-01T07:30:00Z'))).toBe(
      epoch('2026-03-15T06:30:00Z'),
    )
    expect(latestScheduleTime(spec, epoch('2026-03-08T16:00:00Z'))).toBe(
      epoch('2026-03-01T07:30:00Z'),
    )
    const apia = weekly('Pacific/Apia', [5], 9)
    expect(nextScheduleTime(apia, epoch('2011-12-23T19:00:00Z'))).toBe(
      epoch('2012-01-05T19:00:00Z'),
    )
  })

  it('jumps to now after years away rather than replaying the missed interval', () => {
    const spec = weekly('UTC', [1], 9)
    const now = epoch('2056-09-23T18:00:00Z')
    const arithmetic = vi.spyOn(Temporal.PlainDate.prototype, 'add')
    let latest: number, next: number
    try {
      latest = latestScheduleTime(spec, now)!
      expect(arithmetic.mock.calls.length).toBeLessThan(
        scheduleCalendarSearchLimit,
      )
      arithmetic.mockClear()
      next = nextScheduleTime(spec, now)!
      expect(arithmetic.mock.calls.length).toBeLessThan(
        scheduleCalendarSearchLimit,
      )
    } finally {
      arithmetic.mockRestore()
    }
    expect(new Date(latest).getUTCDay()).toBe(1)
    expect(new Date(next).getUTCDay()).toBe(1)
    expect(latest).toBeLessThanOrEqual(now)
    expect(now - latest).toBeLessThan(7 * 86400000)
    expect(next - latest).toBe(7 * 86400000)
    expect(scheduleCalendarSearchLimit).toBe(16)
  })

  it('once is an exact instant even in a fold and can retain an unrelated display zone', () => {
    const at = epoch('2026-11-01T06:30:00Z')
    const spec: ScheduleSpec = { ...daily(), recurrence: { kind: 'once', at } }
    expect(nextScheduleTime(spec, at - 1)).toBe(at)
    expect(nextScheduleTime(spec, at)).toBeUndefined()
    expect(latestScheduleTime(spec, at - 1)).toBeUndefined()
    expect(latestScheduleTime(spec, at)).toBe(at)
  })

  it('ends cleanly at representable bounds instead of producing invalid dates', () => {
    expect(latestScheduleTime(daily('UTC', 0), 0)).toBe(0)
    expect(latestScheduleTime(daily('UTC', 1), 0)).toBeUndefined()
    expect(nextScheduleTime(daily('UTC', 0), maxScheduleEpoch)).toBeUndefined()
    expect(latestScheduleTime(daily('UTC', 23), maxScheduleEpoch)).toBe(
      maxScheduleEpoch - 3600000,
    )
    expect(
      nextScheduleTime(daily('UTC', 23), maxScheduleEpoch - 1),
    ).toBeUndefined()
  })
})

describe('schedule input boundaries', () => {
  it.each([
    'America/Denver',
    'UTC',
    'US/Eastern',
    'Etc/GMT+5',
    'Asia/Kathmandu',
  ])(
    'accepts the recognized named zone %s without rewriting it',
    (timezone) => {
      expect(scheduleSpecSchema.parse(daily(timezone)).timezone).toBe(timezone)
    },
  )
  it.each([
    'Mars/Olympus',
    'PST',
    '+05:30',
    '-07:00',
    '',
    ' America/Denver',
    'America/Denver ',
    'UTC\u0000',
  ])('rejects invalid or offset-only zone %s', (timezone) => {
    expect(scheduleSpecSchema.safeParse(daily(timezone)).success).toBe(false)
  })
  it.each([
    NaN,
    Infinity,
    -1,
    1.5,
    maxScheduleEpoch + 1,
    Number.MAX_SAFE_INTEGER,
  ])('rejects invalid epoch %s for both boundaries and once', (at) => {
    expect(() => nextScheduleTime(daily(), at)).toThrow()
    expect(() => latestScheduleTime(daily(), at)).toThrow()
    expect(
      scheduleSpecSchema.safeParse({
        ...daily(),
        recurrence: { kind: 'once', at },
      }).success,
    ).toBe(false)
  })
  it.each([
    { kind: 'daily', hour: 24, minute: 0 },
    { kind: 'daily', hour: 12, minute: 60 },
    { kind: 'daily', hour: 9.5, minute: 0 },
    { kind: 'weekly', days: [], hour: 9, minute: 0 },
    { kind: 'weekly', days: [0], hour: 9, minute: 0 },
    { kind: 'weekly', days: [8], hour: 9, minute: 0 },
    { kind: 'weekly', days: [1, 1], hour: 9, minute: 0 },
    { kind: 'once', at: '2026-02-30T09:00:00Z' },
    { kind: 'daily', hour: 9, minute: 0, at: 42 },
  ])(
    'rejects invalid recurrence %j rather than normalizing it',
    (recurrence) => {
      expect(
        scheduleSpecSchema.safeParse({ ...daily(), recurrence }).success,
      ).toBe(false)
    },
  )
  it('keeps strict public selections and rejects hidden authority or duplicated references', () => {
    const valid = {
      ...daily(),
      runModel: { provider: 'included', model: 'model' },
      references: [{ kind: 'connection', serverId: 'connected-account' }],
    }
    expect(scheduleSpecSchema.parse(valid)).toEqual(valid)
    for (const spec of [
      { ...valid, credentials: 'secret' },
      { ...valid, name: 'x'.repeat(81) },
      { ...valid, objective: 'x'.repeat(12001) },
      { ...valid, objective: ' ' },
      { ...valid, runModel: { ...valid.runModel, apiKey: 'secret' } },
      { ...valid, references: [...valid.references, ...valid.references] },
    ])
      expect(scheduleSpecSchema.safeParse(spec).success).toBe(false)
  })
  it('requires exact command IDs and optimistic revisions without capability fields', () => {
    expect(
      scheduleCommandSchema.parse({ type: 'create', commandId, spec: daily() })
        .type,
    ).toBe('create')
    expect(
      scheduleCommandSchema.parse({
        type: 'update',
        commandId,
        id,
        revision: 1,
        spec: daily(),
      }).type,
    ).toBe('update')
    for (const type of ['pause', 'resume', 'delete', 'run-now']) {
      expect(
        scheduleCommandSchema.parse({ type, commandId, id, revision: 1 }).type,
      ).toBe(type)
      expect(
        scheduleCommandSchema.safeParse({ type, commandId, id, revision: 0 })
          .success,
      ).toBe(false)
      expect(
        scheduleCommandSchema.safeParse({
          type,
          commandId,
          id,
          revision: 1,
          force: true,
        }).success,
      ).toBe(false)
    }
    expect(
      scheduleCommandSchema.parse({
        type: 'cancel-run',
        commandId,
        occurrenceId: id,
      }).type,
    ).toBe('cancel-run')
    expect(
      scheduleCommandSchema.safeParse({
        type: 'create',
        commandId: 'bad',
        spec: daily(),
      }).success,
    ).toBe(false)
  })
  it('parses bounded metadata without storing objective copies or secrets on occurrences', () => {
    const record = {
      id,
      identity: {
        workspaceId: 'w',
        userId: 'u',
        botId: 'b',
        conversationId: 'exact-child',
      },
      revision: 1,
      status: 'active',
      spec: daily(),
      createdAt: 1,
      updatedAt: 1,
    }
    const occurrence = {
      id: commandId,
      scheduleId: id,
      revision: 1,
      source: 'timer',
      dueAt: 2,
      createdAt: 1,
      updatedAt: 1,
      status: 'pending',
      retryAt: 3,
    }
    expect(
      scheduleSnapshotSchema.parse({
        schedules: [record],
        occurrences: [occurrence],
      }).occurrences[0].retryAt,
    ).toBe(3)
    expect(
      scheduleSnapshotSchema.safeParse({
        schedules: [record],
        occurrences: [{ ...occurrence, objective: 'leaked duplicate' }],
      }).success,
    ).toBe(false)
  })
})
