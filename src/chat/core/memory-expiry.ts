import { Temporal } from '@js-temporal/polyfill'

export function formatMemoryExpiry(value: number | null, timeZone: string) {
  return value === null
    ? ''
    : Temporal.Instant.fromEpochMilliseconds(value)
        .toZonedDateTimeISO(timeZone)
        .toPlainDateTime()
        .toString({ smallestUnit: 'minute' })
}
export function parseMemoryExpiry(
  value: string,
  timeZone: string,
  now = Date.now(),
): number | null {
  if (!value.trim()) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error('Choose a valid expiry date and time.')
  let expiresAt: number
  try {
    expiresAt = Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone, {
      disambiguation: 'reject',
    }).epochMilliseconds
  } catch {
    throw Error('Choose an unambiguous expiry time in your time zone.')
  }
  if (expiresAt <= now) throw Error('Choose an expiry in the future.')
  return expiresAt
}

/** An unchanged minute-resolution input must preserve the saved instant,
 * including seconds and either occurrence of a repeated daylight-saving time. */
export function editedMemoryExpiry(
  value: string,
  timeZone: string,
  original: number | null,
  now = Date.now(),
): number | null {
  if (value === formatMemoryExpiry(original, timeZone)) {
    if (original !== null && original <= now)
      throw Error('Choose an expiry in the future.')
    return original
  }
  return parseMemoryExpiry(value, timeZone, now)
}
