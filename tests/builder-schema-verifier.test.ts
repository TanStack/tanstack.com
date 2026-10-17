import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { promisify } from 'node:util'
import postgres from 'postgres'
import {
  BUILDER_MESSAGE_ROLES,
  BUILDER_PROJECT_EVENT_TYPES,
  BUILDER_RUN_STATUSES,
} from '../src/db/types'

const execute = promisify(execFile)
const databaseUrl = process.env.BUILDER_SCHEMA_TEST_DATABASE_URL
const tables = [
  'builder_project_legacy_imports',
  'builder_project_snapshots',
  'builder_project_snapshot_reservations',
  'builder_projects',
  'builder_project_usage',
  'builder_project_tombstones',
  'builder_project_mutation_receipts',
  'builder_project_revisions',
  'builder_project_threads',
  'builder_project_runs',
  'builder_project_messages',
  'builder_project_events',
]
const enums = [
  ['builder_message_role', BUILDER_MESSAGE_ROLES],
  ['builder_run_status', BUILDER_RUN_STATUSES],
  ['builder_project_event_type', BUILDER_PROJECT_EVENT_TYPES],
] as const

test(
  'Builder schema verifier accepts compatible later migrations and rejects invalid schemas',
  { skip: databaseUrl ? false : 'Set BUILDER_SCHEMA_TEST_DATABASE_URL' },
  async (t) => {
    assert.ok(databaseUrl)
    // This suite resets schemas; never accept a production database name.
    const testDatabase = new URL(databaseUrl)
    assert.ok(['localhost', '127.0.0.1'].includes(testDatabase.hostname))
    assert.equal(testDatabase.pathname, '/builder_schema_verifier_tests')
    const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    const journal = JSON.parse(
      await readFile(
        new URL('../drizzle/migrations/meta/_journal.json', import.meta.url),
        'utf8',
      ),
    )
    const migration = journal.entries.at(-1)
    const hash = createHash('sha256')
      .update(
        await readFile(
          new URL(
            `../drizzle/migrations/${migration.tag}.sql`,
            import.meta.url,
          ),
        ),
      )
      .digest('hex')

    async function reset() {
      await sql`drop schema if exists drizzle cascade`
      await sql`drop schema public cascade`
      await sql`create schema public`
      await sql`create schema drizzle`
      await sql`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint not null)`
      await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${migration.when})`
      for (const table of tables) {
        await sql`create table ${sql(table)} (id text primary key)`
      }
      for (const [name, labels] of enums) {
        // Enum labels cannot be bind parameters in CREATE TYPE.
        await sql.unsafe(
          `create type ${name} as enum (${labels.map((label) => `'${label}'`).join(', ')})`,
        )
      }
    }

    async function verify(error?: RegExp) {
      const result = execute(
        process.execPath,
        ['--import', 'tsx', 'scripts/verify-builder-schema.ts'],
        {
          cwd: new URL('../', import.meta.url),
          env: { ...process.env, DATABASE_URL: databaseUrl },
          timeout: 30_000,
        },
      )
      if (error) {
        await assert.rejects(result, error)
      } else {
        assert.match((await result).stdout, /Builder database schema matches/)
      }
    }

    try {
      await t.test(
        'accepts the required migration as the latest entry',
        async () => {
          await reset()
          await verify()
        },
      )
      await t.test('accepts a newer unrelated migration', async () => {
        await reset()
        await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('later-chat-migration', ${migration.when + 1})`
        await verify()
      })
      await t.test('rejects missing migration history', async () => {
        await reset()
        await sql`drop schema drizzle cascade`
        await verify(/Drizzle migration history is missing/)
      })
      await t.test(
        'rejects a newer entry without the required migration',
        async () => {
          await reset()
          await sql`update drizzle.__drizzle_migrations set created_at = ${migration.when + 1}`
          await verify(/Builder database migration mismatch/)
        },
      )
      await t.test('rejects a mismatched migration hash', async () => {
        await reset()
        await sql`update drizzle.__drizzle_migrations set hash = 'wrong-hash'`
        await verify(/Builder database migration mismatch/)
      })
      await t.test(
        'rejects a missing required table after a later migration',
        async () => {
          await reset()
          await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('later-chat-migration', ${migration.when + 1})`
          await sql`drop table builder_projects`
          await verify(/invalid or missing table builder_projects/)
        },
      )
      await t.test('rejects a view in place of a required table', async () => {
        await reset()
        await sql`drop table builder_projects`
        await sql`create view builder_projects as select 'project'::text as id`
        await verify(/invalid or missing table builder_projects/)
      })
      await t.test('rejects a missing required enum', async () => {
        await reset()
        await sql`drop type builder_message_role`
        await verify(/invalid or missing enum builder_message_role/)
      })
      await t.test('rejects incompatible enum labels', async () => {
        await reset()
        await sql`alter type builder_message_role add value 'unexpected'`
        await verify(/invalid or missing enum builder_message_role/)
      })
    } finally {
      await sql.end()
    }
  },
)
