import postgres from 'postgres'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../src/db/schema'

// Deployment verification is read-only. The separate workspace verifier mutates
// only explicitly named isolated test databases.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl)
  throw new Error('DATABASE_URL is required to verify the chat schema')
const tables = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => getTableConfig(table))
  .filter((table) => table.name.startsWith('chat_'))
if (!tables.length)
  throw new Error('No chat tables were found in the shared schema')
const sql = postgres(databaseUrl, {
  connect_timeout: 10,
  idle_timeout: 5,
  max: 1,
})
try {
  const rows = await sql<
    { table_name: string; column_name: string; is_nullable: string }[]
  >`
  SELECT table_name,column_name,is_nullable FROM information_schema.columns
  WHERE table_schema='public' AND table_name LIKE 'chat\_%' ESCAPE '\'
 `
  const missing: string[] = []
  for (const table of tables) {
    for (const column of table.columns) {
      const actual = rows.find(
        (row) =>
          row.table_name === table.name && row.column_name === column.name,
      )
      if (!actual) missing.push(`${table.name}.${column.name} missing`)
      else if (column.notNull && actual.is_nullable !== 'NO')
        missing.push(`${table.name}.${column.name} must be NOT NULL`)
    }
  }
  const [reservation] = await sql<{ ready: boolean }[]>`
    SELECT to_regprocedure('public.reserve_chat_run_usage(jsonb,text)') IS NOT NULL AS ready
  `
  if (!reservation.ready)
    missing.push('reserve_chat_run_usage function missing')
  if (missing.length)
    throw new Error(`Chat schema is not ready:\n${missing.join('\n')}`)
  console.log(
    `Verified ${tables.length} chat tables and their required columns.`,
  )
} finally {
  await sql.end()
}
