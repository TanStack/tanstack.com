import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  snapshotSchema,
  summarize,
  exploreTrips,
  dashboardSearch,
} from '../src/components/dashboard/model'
import { createSnapshotCollections } from '../src/components/dashboard/data'

const raw = readFileSync('public/data/dashboard/green-2025-week1.v1.json')
const snapshot = snapshotSchema.parse(JSON.parse(raw.toString()))
test('snapshot matches the offline source reference and has complete zone joins', () => {
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    'be06c9b2b653d9ba7c4a7de383a7dbb023897fbe91fcf8715fa83ab4c992e35a',
  )
  assert.equal(new Set(snapshot.trips.map((row) => row.id)).size, 8936)
  const zones = new Set(snapshot.zones.map((row) => row.id))
  assert.ok(snapshot.trips.every((row) => zones.has(row.zoneId)))
  assert.deepEqual(summarize(snapshot.trips), {
    count: 8936,
    fareCents: 15225270,
    days: [921, 1408, 1410, 1170, 1054, 1436, 1537].map((count, i) => ({
      day: i + 1,
      count,
    })),
  })
})
test('every borough and day reconciles with its chart totals, including empty slices', () => {
  for (const borough of new Set(snapshot.zones.map((zone) => zone.borough))) {
    const ids = new Set(
      snapshot.zones
        .filter((zone) => zone.borough === borough)
        .map((zone) => zone.id),
    )
    const rows = snapshot.trips.filter((row) => ids.has(row.zoneId))
    const context = summarize(rows)
    for (const day of context.days) {
      const selected = summarize(rows.filter((row) => row.day === day.day))
      assert.equal(selected.count, day.count)
    }
    assert.equal(
      context.days.reduce((sum, day) => sum + day.count, 0),
      context.count,
    )
  }
  assert.equal(summarize([]).fareCents, 0)
})
test('invalid URL values reset to valid defaults', () => {
  assert.deepEqual(
    dashboardSearch.parse({
      day: 35,
      kit: 'fake',
      appearance: 'fake',
      borough: 'fake',
      selected: -1,
    }),
    {
      source: 'server',
      grid: {
        query: '',
        filters: [],
        sorting: [{ id: 'pickup', desc: false }],
        group: '',
        page: 0,
        size: 50,
      },
      day: 0,
      zone: 0,
      kit: 'native',
      appearance: 'light',
      borough: 'All',
      selected: 0,
    },
  )
})
test('route-owned collections clean up and a later visit starts with the full snapshot', async () => {
  for (let visit = 0; visit < 2; visit++) {
    const collections = createSnapshotCollections(snapshot)
    await collections.trips.preload()
    await collections.zones.preload()
    assert.equal(collections.trips.size, 8936)
    await collections.trips.cleanup()
    await collections.zones.cleanup()
    assert.equal(collections.trips.status, 'cleaned-up')
  }
})

test('linked views reconcile, and each navigation view keeps its alternatives', () => {
  const rows = snapshot.trips.map((trip) => ({
    ...trip,
    zone:
      snapshot.zones.find((zone) => zone.id === trip.zoneId)?.name ?? 'Unknown',
    borough: 'All',
  }))
  const all = exploreTrips(rows, 0, 0)
  assert.equal(
    all.timeline.reduce((sum, bin) => sum + bin.count, 0),
    8936,
  )
  assert.equal(
    all.hours.reduce((sum, bin) => sum + bin.count, 0),
    8936,
  )
  assert.equal(
    all.durations.reduce((sum, bin) => sum + bin.count, 0),
    8936,
  )
  const zone = all.zones[0].id
  const narrowed = exploreTrips(rows, 2, zone)
  const reference = rows.filter((row) => row.day === 2 && row.zoneId === zone)
  assert.equal(narrowed.summary.count, reference.length)
  assert.equal(
    narrowed.summary.fareCents,
    reference.reduce((sum, row) => sum + row.fareCents, 0),
  )
  assert.equal(
    narrowed.hours.reduce((sum, bin) => sum + bin.count, 0),
    reference.length,
  )
  assert.equal(
    narrowed.durations.reduce((sum, bin) => sum + bin.count, 0),
    reference.length,
  )
  assert.ok(narrowed.zones.length > 1)
  assert.equal(
    narrowed.timeline.reduce((sum, bin) => sum + bin.count, 0),
    rows.filter((row) => row.zoneId === zone).length,
  )
  const empty = exploreTrips(rows, 1, 9999)
  assert.equal(empty.summary.count, 0)
  assert.equal(empty.medianMinutes, 0)
  assert.equal(empty.averageMiles, 0)
})
