import { expect, it } from 'vitest'
import {
  editedMemoryExpiry,
  formatMemoryExpiry,
  parseMemoryExpiry,
} from '../../src/chat/core/memory-expiry'
it('preserves exact saved instants for unrelated edits, including repeated local times', () => {
  for (const timestamp of [
    '2026-10-01T18:30:42.123Z',
    '2026-11-01T05:30:42.123Z',
    '2026-11-01T06:30:42.123Z',
  ]) {
    const original = Date.parse(timestamp)
    const text = formatMemoryExpiry(original, 'America/New_York')
    expect(editedMemoryExpiry(text, 'America/New_York', original, 0)).toBe(
      original,
    )
    expect(() =>
      editedMemoryExpiry(text, 'America/New_York', original, original),
    ).toThrow('future')
  }
})
it('allows deliberate expiry changes and removal while rejecting new ambiguous times', () => {
  const original = Date.parse('2026-10-01T18:30:42.123Z')
  expect(editedMemoryExpiry('', 'UTC', original, 0)).toBeNull()
  expect(editedMemoryExpiry('2026-10-02T18:30', 'UTC', original, 0)).toBe(
    Date.parse('2026-10-02T18:30Z'),
  )
  expect(() =>
    editedMemoryExpiry('2026-11-01T01:30', 'America/New_York', original, 0),
  ).toThrow('unambiguous')
})
it('round trips local expiry into a specific instant and allows removing expiry', () => {
  const instant = Date.parse('2026-10-01T18:30:00Z')
  expect(formatMemoryExpiry(instant, 'America/Denver')).toBe('2026-10-01T12:30')
  expect(parseMemoryExpiry('2026-10-01T12:30', 'America/Denver', 0)).toBe(
    instant,
  )
  expect(parseMemoryExpiry('', 'UTC')).toBeNull()
  expect(formatMemoryExpiry(null, 'UTC')).toBe('')
})
it('rejects past, impossible, ambiguous and skipped local times', () => {
  expect(() =>
    parseMemoryExpiry('2026-01-01T12:00', 'UTC', Date.parse('2026-02-01')),
  ).toThrow('future')
  for (const date of [
    '2026-02-30T12:00',
    '2026-03-08T02:30',
    '2026-11-01T01:30',
  ])
    expect(() => parseMemoryExpiry(date, 'America/New_York', 0)).toThrow(
      'unambiguous',
    )
  expect(() => parseMemoryExpiry('October 1', 'UTC', 0)).toThrow('valid')
})
