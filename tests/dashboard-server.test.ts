import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { snapshotSchema, exploreTrips } from '../src/components/dashboard/model'
import { serverRequestSchema } from '../src/components/dashboard/request'
import {
  readDashboard,
  exportDashboard,
  type Execute,
} from '../src/components/dashboard/server/queries'

const db = new PGlite()
const snapshot = snapshotSchema.parse(
  JSON.parse(
    await readFile('public/data/dashboard/green-2025-week1.v1.json', 'utf8'),
  ),
)
const rows = snapshot.trips.map((trip) => {
  const zone = snapshot.zones.find((z) => z.id === trip.zoneId)
  assert.ok(zone)
  return { ...trip, zone: zone.name, borough: zone.borough }
})
const execute: Execute = async (sql, values) =>
  (await db.query(sql, values)).rows
const request = (patch: Record<string, unknown> = {}) =>
  serverRequestSchema.parse({
    day: 0,
    zone: 0,
    borough: 'All',
    grid: {},
    selection: {},
    selected: 0,
    ...patch,
  })
before(async () => {
  await db.exec(
    await readFile('src/components/dashboard/server/schema.sql', 'utf8'),
  )
  await db.query(
    `INSERT INTO dashboard.zones SELECT * FROM json_populate_recordset(NULL::dashboard.zones,$1::json)`,
    [JSON.stringify(snapshot.zones)],
  )
  await db.query(
    `INSERT INTO dashboard.trips SELECT * FROM json_populate_recordset(NULL::dashboard.trips,$1::json)`,
    [JSON.stringify(snapshot.trips)],
  )
})
after(() => db.close())
test('SQL charts and totals match client calculations across boroughs, days, zones and empty results', async () => {
  for (const patch of [
    {},
    { borough: 'Queens', day: 1 },
    { borough: 'Brooklyn', day: 3, zone: 25 },
    { borough: 'Staten Island' },
    { borough: 'Queens', zone: 196 },
    { day: 7 },
  ]) {
    const input = request(patch)
    const client = exploreTrips(
      rows.filter(
        (row) => input.borough === 'All' || row.borough === input.borough,
      ),
      input.day,
      input.zone,
    )
    const server = await readDashboard(execute, input)
    assert.equal(server.analysis.summary.count, client.summary.count)
    assert.equal(server.analysis.summary.fareCents, client.summary.fareCents)
    assert.equal(server.analysis.medianMinutes, client.medianMinutes)
    assert.ok(
      Math.abs(server.analysis.averageMiles - client.averageMiles) < 1e-9,
    )
    for (const field of ['timeline', 'hours', 'durations', 'days', 'zones']) {
      assert.deepEqual(
        Reflect.get(server.analysis, field),
        Reflect.get(client, field),
      )
    }
    assert.ok(server.rows.length <= 50)
  }
})
test('SQL filters apply before numeric sort and deterministic pagination, including late pages', async () => {
  const input = request({
    borough: 'Queens',
    grid: {
      query: 'Forest Hills',
      filters: [{ id: 'fareCents', value: [10, 30] }],
      sorting: [{ id: 'minutes', desc: true }],
      size: 25,
      page: 1,
    },
  })
  const result = await readDashboard(execute, input)
  const expected = rows
    .filter(
      (row) =>
        row.borough === 'Queens' &&
        row.zone === 'Forest Hills' &&
        row.fareCents >= 1000 &&
        row.fareCents <= 3000,
    )
    .sort((a, b) => b.minutes - a.minutes || a.id - b.id)
  assert.equal(result.total.count, expected.length)
  assert.deepEqual(
    result.rows.map((row) => row.id),
    expected.slice(25, 50).map((row) => row.id),
  )
  const last = await readDashboard(execute, request({ grid: { page: 100000 } }))
  assert.equal(last.page, Math.ceil(rows.length / 50) - 1)
  assert.equal(last.rows.length, rows.length % 50)
})
test('grouping aggregates every matching record before pagination', async () => {
  const grouped = await readDashboard(
    execute,
    request({ grid: { group: 'borough' } }),
  )
  assert.equal(
    grouped.rows.reduce((sum, row) => sum + (row.group?.count ?? 0), 0),
    rows.length,
  )
  assert.equal(
    grouped.rows.reduce((sum, row) => sum + row.fareCents, 0),
    15225270,
  )
  const queens = grouped.rows.find((row) => row.group?.value === 'Queens')
  assert.ok(queens)
  assert.equal(queens.group?.count, 1960)
})
test('all-matching selection supports exclusions and exports beyond the loaded page', async () => {
  const queens = rows.filter((row) => row.borough === 'Queens')
  const input = request({
    borough: 'Queens',
    selection: { all: true, ids: [queens[0].id] },
  })
  const result = await readDashboard(execute, input)
  assert.equal(result.rows.length, 50)
  assert.equal(result.selectedTotals.count, 1959)
  const exported = await exportDashboard(execute, input, true)
  assert.equal(exported.length, 1959)
  assert.ok(exported.every((row) => row.id !== queens[0].id))
  assert.equal(
    exported.reduce((sum, row) => sum + row.fareCents, 0),
    result.selectedTotals.fareCents,
  )
  const explicit = await readDashboard(
    execute,
    request({ selection: { ids: [rows[0].id, rows[100].id] } }),
  )
  assert.equal(explicit.selectedTotals.count, 2)
})
test('selected record details are fetched independently of the page and filter', async () => {
  const selected = rows.find((row) => row.borough === 'Queens')
  assert.ok(selected)
  const result = await readDashboard(
    execute,
    request({ borough: 'Manhattan', selected: selected.id }),
  )
  assert.equal(result.selected?.id, selected.id)
  assert.equal(result.selectedMatches, false)
})
test('search parameters remain literal SQL values and invalid columns cannot become SQL', async () => {
  const input = request({ grid: { query: "%' OR 1=1 --" } })
  assert.equal((await readDashboard(execute, input)).total.count, 0)
  assert.equal((await readDashboard(execute, request())).total.count, 8936)
  assert.deepEqual(
    request({
      grid: { sorting: [{ id: 'id; DROP TABLE dashboard.trips', desc: true }] },
    }).grid.sorting,
    [{ id: 'pickup', desc: false }],
  )
})
