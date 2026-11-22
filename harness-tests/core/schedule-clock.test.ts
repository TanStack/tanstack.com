import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import { maxScheduleEpoch } from '../../src/chat/core/schedules'
import {
  resolveScheduleTime,
  scheduleClockInputSchema,
} from '../../src/chat/server/schedule-clock'

const now = Date.parse('2026-09-23T18:00:00.123Z')

it('resolves a local date from the supplied IANA timezone and presents both actual dates', () => {
  const result = resolveScheduleTime(
    { timezone: 'America/Denver', localDateTime: '2026-09-24T09:30' },
    now,
  )
  expect(result.now).toMatchObject({
    at: now,
    iso: '2026-09-23T18:00:00.123Z',
    timezone: 'America/Denver',
  })
  expect(result.now.local).toContain('Wednesday, September 23, 2026')
  expect(result.now.local).toContain('12:00:00 PM')
  expect(result.resolved).toMatchObject({
    at: Date.parse('2026-09-24T15:30:00Z'),
    iso: '2026-09-24T15:30:00.000Z',
    timezone: 'America/Denver',
  })
  expect(result.resolved.local).toContain('Thursday, September 24, 2026')
  expect(result.resolved.local).toContain('9:30:00 AM')
})

it('rejects a spring-forward gap and a whole skipped local date', () => {
  for (const input of [
    { timezone: 'America/New_York', localDateTime: '2026-03-08T02:30' },
    { timezone: 'Australia/Lord_Howe', localDateTime: '2026-10-04T02:15' },
    { timezone: 'Pacific/Apia', localDateTime: '2011-12-30T09:00' },
  ])
    expect(() => resolveScheduleTime(input, now)).toThrow(
      'skipped by a clock change',
    )
})

it('chooses the earlier fold instant, including a half-hour clock change', () => {
  expect(
    resolveScheduleTime(
      { timezone: 'America/New_York', localDateTime: '2026-11-01T01:30' },
      now,
    ).resolved.iso,
  ).toBe('2026-11-01T05:30:00.000Z')
  expect(
    resolveScheduleTime(
      { timezone: 'Australia/Lord_Howe', localDateTime: '2026-04-05T01:45' },
      now,
    ).resolved.iso,
  ).toBe('2026-04-04T14:45:00.000Z')
})

it('supports Kathmandu quarter-hour offsets, leap days, seconds and exact milliseconds', () => {
  const result = resolveScheduleTime(
    { timezone: 'Asia/Kathmandu', localDateTime: '2028-02-29T09:15:27.045' },
    now,
  )
  expect(result.resolved.iso).toBe('2028-02-29T03:30:27.045Z')
  expect(result.resolved.at).toBe(Date.parse(result.resolved.iso))
  expect(result.resolved.local).toContain('Tuesday, February 29, 2028')
  expect(result.resolved.local).toContain('9:15:27 AM')
  expect(result.resolved.timezone).toBe('Asia/Kathmandu')
})

it('computes elapsed delays across midnight, year boundaries and DST changes', () => {
  const year = resolveScheduleTime(
    { timezone: 'America/Denver', delaySeconds: 90 },
    Date.parse('2027-01-01T06:59:30.123Z'),
  )
  expect(year.resolved.iso).toBe('2027-01-01T07:01:00.123Z')
  expect(year.now.local).toContain('December 31, 2026')
  expect(year.resolved.local).toContain('January 1, 2027')
  const spring = resolveScheduleTime(
    { timezone: 'America/New_York', delaySeconds: 3600 },
    Date.parse('2026-03-08T06:30:00Z'),
  )
  expect(spring.resolved.iso).toBe('2026-03-08T07:30:00.000Z')
  expect(spring.resolved.local).toContain('3:30:00 AM')
})

it('captures the server clock once when no test clock is supplied', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    const result = resolveScheduleTime({ timezone: 'UTC', delaySeconds: 1 })
    expect(clock).toHaveBeenCalledTimes(1)
    expect(result.now.at).toBe(now)
    expect(result.resolved.at).toBe(now + 1000)
  } finally {
    clock.mockRestore()
  }
})

it('uses a flat strict provider schema with portable patterns', () => {
  const json = z.toJSONSchema(scheduleClockInputSchema)
  expect(json.type).toBe('object')
  expect(Object.keys(json.properties!)).toEqual([
    'timezone',
    'localDateTime',
    'delaySeconds',
  ])
  expect(json.additionalProperties).toBe(false)
  expect(json).not.toHaveProperty('anyOf')
  expect(json).not.toHaveProperty('oneOf')
  for (const field of Object.values(json.properties!))
    if (typeof field === 'object' && typeof field.pattern === 'string') {
      const pattern = field.pattern
      expect(pattern).not.toContain('\\p{')
      expect(() => new RegExp(pattern)).not.toThrow()
    }
})

it.each([
  {},
  { timezone: 'UTC' },
  { timezone: 'UTC', localDateTime: '2026-09-24T09:00', delaySeconds: 1 },
  { timezone: 'UTC', delaySeconds: 0 },
  { timezone: 'UTC', delaySeconds: -1 },
  { timezone: 'UTC', delaySeconds: 1.5 },
  { timezone: 'UTC', delaySeconds: '60' },
  { timezone: 'UTC', delaySeconds: Infinity },
  { timezone: 'UTC', delaySeconds: NaN },
  { timezone: 'UTC', delaySeconds: Number.MAX_SAFE_INTEGER },
  { timezone: 'UTC', delaySeconds: 1, at: now },
  { timezone: 'UTC', delaySeconds: 1, command: 'create' },
  { timezone: 'UTC', delaySeconds: null },
  { timezone: '+05:45', delaySeconds: 1 },
  { timezone: 'PST', delaySeconds: 1 },
  { timezone: 'Mars/Olympus', delaySeconds: 1 },
  { timezone: 'UTC', localDateTime: '2026-02-29T09:00' },
  { timezone: 'UTC', localDateTime: '2026-09-31T09:00' },
  { timezone: 'UTC', localDateTime: '2026-09-23' },
  { timezone: 'UTC', localDateTime: '2026-09-23T24:00' },
  { timezone: 'UTC', localDateTime: '2026-09-23T09:00:60' },
  { timezone: 'UTC', localDateTime: '2026-09-23T09:00:00.0001' },
  { timezone: 'UTC', localDateTime: '2026-09-23T09:00Z' },
  { timezone: 'UTC', localDateTime: '2026-09-23T09:00+05:45' },
  { timezone: 'UTC', localDateTime: '2026-09-23T09:00[Asia/Kathmandu]' },
  { timezone: 'UTC', localDateTime: ' 2026-09-23T09:00' },
  { timezone: 'UTC', localDateTime: '２０２６-09-23T09:00' },
])('rejects invalid, ambiguous or extraneous input %j', (input) => {
  expect(scheduleClockInputSchema.safeParse(input).success).toBe(false)
  expect(() => resolveScheduleTime(input, now)).toThrow()
})

it('checks supported epoch bounds before adding a delay or returning a calendar instant', () => {
  expect(
    resolveScheduleTime(
      { timezone: 'UTC', delaySeconds: maxScheduleEpoch / 1000 },
      0,
    ).resolved.at,
  ).toBe(maxScheduleEpoch)
  expect(
    resolveScheduleTime(
      { timezone: 'UTC', delaySeconds: 1 },
      maxScheduleEpoch - 1000,
    ).resolved.iso,
  ).toBe('+275760-09-13T00:00:00.000Z')
  expect(() =>
    resolveScheduleTime(
      { timezone: 'UTC', delaySeconds: 1 },
      maxScheduleEpoch - 999,
    ),
  ).toThrow('supported date range')
  expect(() =>
    resolveScheduleTime(
      { timezone: 'UTC', localDateTime: '1969-12-31T23:59' },
      now,
    ),
  ).toThrow()
  for (const invalid of [-1, 1.5, NaN, Infinity, maxScheduleEpoch + 1])
    expect(() =>
      resolveScheduleTime({ timezone: 'UTC', delaySeconds: 1 }, invalid),
    ).toThrow()
})
