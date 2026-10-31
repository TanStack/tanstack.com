import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../drizzle/migrations/0000_builder_durability.sql',
  import.meta.url,
)

const expectedTables = [
  'builder_project_events',
  'builder_project_legacy_imports',
  'builder_project_messages',
  'builder_project_mutation_receipts',
  'builder_project_revisions',
  'builder_project_runs',
  'builder_project_snapshot_reservations',
  'builder_project_snapshots',
  'builder_project_threads',
  'builder_project_tombstones',
  'builder_project_usage',
  'builder_projects',
] as const

const expectedTypes = [
  'builder_message_role',
  'builder_project_event_type',
  'builder_run_status',
] as const

function collectNames(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1]).sort()
}

test('the initial tracked migration contains only Builder schema additions', async () => {
  const migration = await readFile(migrationUrl, 'utf8')

  assert.deepEqual(
    collectNames(migration, /CREATE TABLE "([^"]+)"/g),
    [...expectedTables].sort(),
  )
  assert.deepEqual(
    collectNames(migration, /CREATE TYPE "public"\."([^"]+)"/g),
    [...expectedTypes].sort(),
  )

  const alteredTables = collectNames(migration, /ALTER TABLE "([^"]+)"/g)
  assert.ok(alteredTables.length > 0)
  assert.ok(alteredTables.every((table) => table.startsWith('builder_')))

  const indexes = collectNames(migration, /CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)
  assert.ok(indexes.length > 0)
  assert.ok(indexes.every((index) => index.startsWith('builder_')))

  assert.match(migration, /"queue_kind" varchar\(10\) DEFAULT 'queue' NOT NULL/)
  assert.match(
    migration,
    /FOREIGN KEY \("project_id","thread_id","run_id"\) REFERENCES "public"\."builder_project_runs"\("project_id","thread_id","id"\)/,
  )
})
