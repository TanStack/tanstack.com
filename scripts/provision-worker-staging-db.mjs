import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
const c = JSON.parse(fs.readFileSync('.staging/credentials.json', 'utf8'))
const direct = new URL(c.DIRECT_DATABASE_URL)
if (direct.hostname !== 'ep-blue-rice-b4fz0smd.c-6.us-east-2.aws.neon.tech')
  throw new Error('Not staging')
const admin = postgres(direct.toString(), { max: 1 })
const existing =
  await admin`SELECT 1 FROM pg_database WHERE datname='worker_staging_auth'`
if (!existing.length) await admin.unsafe('CREATE DATABASE worker_staging_auth')
await admin.end()
direct.pathname = '/worker_staging_auth'
const pooled = new URL(c.DATABASE_URL)
pooled.pathname = direct.pathname
const folder = '.staging/baseline-migrations'
fs.mkdirSync(path.join(folder, 'meta'), { recursive: true })
const snapshot = JSON.parse(
  fs.readFileSync('drizzle/migrations/meta/0000_snapshot.json', 'utf8'),
)
const statements = await generateMigration(generateDrizzleJson({}), snapshot)
fs.writeFileSync(
  path.join(folder, '0000_staging_baseline.sql'),
  statements.join('\n--> statement-breakpoint\n'),
)
const journal = JSON.parse(
  fs.readFileSync('drizzle/migrations/meta/_journal.json', 'utf8'),
)
journal.entries[0].tag = '0000_staging_baseline'
fs.writeFileSync(
  path.join(folder, 'meta/_journal.json'),
  JSON.stringify(journal),
)
for (const entry of journal.entries.slice(1))
  fs.copyFileSync(
    `drizzle/migrations/${entry.tag}.sql`,
    path.join(folder, `${entry.tag}.sql`),
  )
const sql = postgres(direct.toString(), { max: 1 })
try {
  await migrate(drizzle(sql), { migrationsFolder: folder })
  const tables =
    await sql`select count(*)::int as count from information_schema.tables where table_schema='public'`
  const triggers =
    await sql`select count(*)::int as count from information_schema.triggers where trigger_schema='public'`
  fs.writeFileSync(
    '.staging/credentials.json',
    JSON.stringify({
      ...c,
      DATABASE_URL: pooled.toString(),
      DIRECT_DATABASE_URL: direct.toString(),
    }),
    { mode: 0o600 },
  )
  console.log({
    database: direct.pathname,
    tables: tables[0].count,
    triggers: triggers[0].count,
    baseline: '0000_snapshot.json',
    migrations: journal.entries.length,
  })
} finally {
  await sql.end()
}
