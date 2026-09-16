import postgres from 'postgres'
import { readFile } from 'node:fs/promises'
import { snapshotSchema } from '../../src/components/dashboard/model'

const url = process.env.DASHBOARD_DATABASE_URL
if (!url)
  throw new Error(
    'Set DASHBOARD_DATABASE_URL explicitly. This script never uses the site DATABASE_URL.',
  )
const snapshot = snapshotSchema.parse(
  JSON.parse(
    await readFile('public/data/dashboard/green-2025-week1.v1.json', 'utf8'),
  ),
)
const schema = await readFile(
  'src/components/dashboard/server/schema.sql',
  'utf8',
)
const sql = postgres(url, { max: 1, fetch_types: false })
try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe(schema)
    await transaction.unsafe(
      'INSERT INTO dashboard.zones SELECT * FROM json_populate_recordset(NULL::dashboard.zones,$1::json) ON CONFLICT (id) DO NOTHING',
      [snapshot.zones],
    )
    for (let start = 0; start < snapshot.trips.length; start += 500)
      await transaction.unsafe(
        'INSERT INTO dashboard.trips SELECT * FROM json_populate_recordset(NULL::dashboard.trips,$1::json) ON CONFLICT (id) DO NOTHING',
        [snapshot.trips.slice(start, start + 500)],
      )
    await transaction.unsafe('ANALYZE dashboard.trips')
  })
  console.log('Dashboard snapshot imported into its PostgreSQL schema.')
} finally {
  await sql.end()
}
