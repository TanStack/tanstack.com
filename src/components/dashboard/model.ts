import { z } from 'zod'
import { gridRequestSchema } from './request'

export const snapshotSchema = z.object({
  trips: z.array(
    z.object({
      id: z.number().int(),
      pickup: z.string(),
      day: z.number().int().min(1).max(7),
      zoneId: z.number().int(),
      dropoffZoneId: z.number().int(),
      miles: z.number().positive(),
      minutes: z.number().positive(),
      fareCents: z.number().int().positive(),
    }),
  ),
  zones: z.array(
    z.object({ id: z.number().int(), name: z.string(), borough: z.string() }),
  ),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Trip = Snapshot['trips'][number]
export type RecordRow = Trip & {
  zone: string
  borough: string
  group?: { value: string; count: number }
}
export const dashboardSearch = z.object({
  source: z.enum(['server', 'client']).catch('server'),
  grid: gridRequestSchema.catch(() => gridRequestSchema.parse({})),
  day: z.number().int().min(0).max(7).catch(0),
  zone: z.number().int().nonnegative().catch(0),
  borough: z
    .enum([
      'All',
      'Bronx',
      'Brooklyn',
      'Manhattan',
      'Queens',
      'Staten Island',
      'Unknown',
      'N/A',
    ])
    .catch('All'),
  kit: z.enum(['native', 'material', 'shadcn']).catch('native'),
  appearance: z.enum(['light', 'dark']).catch('light'),
  selected: z.number().int().nonnegative().catch(0),
})
export type DashboardSearch = z.infer<typeof dashboardSearch>
export function summarize(rows: readonly Trip[]) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, count: 0 }))
  let fareCents = 0
  for (const row of rows) {
    days[row.day - 1].count++
    fareCents += row.fareCents
  }
  return { days, fareCents, count: rows.length }
}
export const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export function exploreTrips(
  rows: readonly RecordRow[],
  day: number,
  zone: number,
) {
  const zoneContext = day ? rows.filter((row) => row.day === day) : rows
  const trendContext = zone ? rows.filter((row) => row.zoneId === zone) : rows
  const selected = zoneContext.filter((row) => !zone || row.zoneId === zone)
  const timeline = Array.from({ length: 168 }, (_, index) => ({
    index,
    day: Math.floor(index / 24) + 1,
    count: 0,
  }))
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  const durations = [
    { label: '0–10', count: 0 },
    { label: '10–20', count: 0 },
    { label: '20–30', count: 0 },
    { label: '30–60', count: 0 },
    { label: '60–180', count: 0 },
  ]
  const zones = new Map<number, { id: number; name: string; count: number }>()
  for (const row of trendContext)
    timeline[(row.day - 1) * 24 + Number(row.pickup.slice(11, 13))].count++
  for (const row of zoneContext) {
    const previous = zones.get(row.zoneId)
    if (previous) previous.count++
    else zones.set(row.zoneId, { id: row.zoneId, name: row.zone, count: 1 })
  }
  let miles = 0
  for (const row of selected) {
    hours[Number(row.pickup.slice(11, 13))].count++
    durations[
      row.minutes < 10
        ? 0
        : row.minutes < 20
          ? 1
          : row.minutes < 30
            ? 2
            : row.minutes < 60
              ? 3
              : 4
    ].count++
    miles += row.miles
  }
  const minutes = selected.map((row) => row.minutes).sort((a, b) => a - b)
  const middle = Math.floor(minutes.length / 2)
  const medianMinutes = minutes.length
    ? minutes.length % 2
      ? minutes[middle]
      : (minutes[middle - 1] + minutes[middle]) / 2
    : 0
  return {
    rows: selected,
    timeline,
    hours,
    durations,
    zones: [...zones.values()].sort((a, b) => b.count - a.count || a.id - b.id),
    summary: summarize(selected),
    days: summarize(trendContext).days,
    medianMinutes,
    averageMiles: selected.length ? miles / selected.length : 0,
  }
}
