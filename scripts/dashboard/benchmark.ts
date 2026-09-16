import postgres from 'postgres'
import { writeFile } from 'node:fs/promises'
import {
  readDashboard,
  type Execute,
} from '../../src/components/dashboard/server/queries'
import { serverRequestSchema } from '../../src/components/dashboard/request'
import { dashboardSearch } from '../../src/components/dashboard/model'

const url = process.env.DASHBOARD_BENCHMARK_DATABASE_URL
if (!url)
  throw new Error(
    'Set DASHBOARD_BENCHMARK_DATABASE_URL to a disposable seeded database.',
  )
// Deliberately separate from both application database bindings.
const sql = postgres(url, { max: 1, fetch_types: false })
try {
  const count = await sql`SELECT count(*)::int AS count FROM dashboard.trips`
  const original = count[0].count
  if (original !== 8936)
    throw new Error('Benchmark requires a fresh 8,936-row seed.')
  await sql`INSERT INTO dashboard.trips
    SELECT id + n * 1000000, pickup, day, "zoneId", "dropoffZoneId", miles, minutes, "fareCents"
    FROM dashboard.trips CROSS JOIN generate_series(1,111) n`
  await sql`ANALYZE dashboard.trips`
  const base = serverRequestSchema.parse({
    ...dashboardSearch.parse({}),
    selection: { all: false, ids: [] },
  })
  const cases = [
    { name: 'overview', request: base },
    { name: 'borough-day', request: { ...base, borough: 'Queens', day: 1 } },
    {
      name: 'substring',
      request: { ...base, grid: { ...base.grid, query: 'Forest' } },
    },
    {
      name: 'late-page',
      request: { ...base, grid: { ...base.grid, page: 15000 } },
    },
    {
      name: 'fare-sort',
      request: {
        ...base,
        grid: { ...base.grid, sorting: [{ id: 'fareCents', desc: true }] },
      },
    },
    {
      name: 'group-day',
      request: { ...base, grid: { ...base.grid, group: 'day' } },
    },
    {
      name: 'all-selected',
      request: { ...base, selection: { all: true, ids: [32] } },
    },
  ]
  const results = []
  for (const item of cases) {
    const request = serverRequestSchema.parse(item.request)
    const samples = []
    let matched = 0
    for (let run = 0; run < 4; run++) {
      const started = performance.now()
      const result = await sql.begin(
        'isolation level repeatable read read only',
        async (tx) => {
          const execute: Execute = async (query, values) =>
            Array.from(await tx.unsafe(query, values))
          return readDashboard(execute, request)
        },
      )
      matched = result.total.count
      if (run) samples.push(Math.round(performance.now() - started))
    }
    results.push({ name: item.name, matched, samplesMs: samples })
    console.log(JSON.stringify(results.at(-1)))
  }
  await writeFile(
    'docs/dashboard/benchmark-results.json',
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        database: 'PostgreSQL 17, local single connection',
        rows: 8936 * 112,
        fixture:
          '112 copies of the same week, unique IDs; synthetic, no new data diversity',
        warmupRuns: 1,
        measuredRuns: 3,
        results,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await sql.end()
}
