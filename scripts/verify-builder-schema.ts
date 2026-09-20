import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { z } from 'zod'
import {
  BUILDER_MESSAGE_ROLES,
  BUILDER_PROJECT_EVENT_TYPES,
  BUILDER_RUN_STATUSES,
} from '../src/db/types'

const requiredRelations = [
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
] as const

const requiredTypes = [
  {
    name: 'builder_message_role',
    labels: BUILDER_MESSAGE_ROLES,
  },
  {
    name: 'builder_run_status',
    labels: BUILDER_RUN_STATUSES,
  },
  {
    name: 'builder_project_event_type',
    labels: BUILDER_PROJECT_EVENT_TYPES,
  },
] as const

const migrationEntrySchema = z.object({
  tag: z.string().regex(/^\d{4}_[a-z0-9_]+$/),
  when: z.number().int().positive(),
})

const migrationJournalSchema = z.object({
  version: z.literal('7'),
  dialect: z.literal('postgresql'),
  entries: z.tuple([migrationEntrySchema]).rest(migrationEntrySchema),
})

const journalUrl = new URL(
  '../drizzle/migrations/meta/_journal.json',
  import.meta.url,
)
const journal = migrationJournalSchema.parse(
  JSON.parse(await readFile(journalUrl, 'utf8')),
)
const latestMigration = journal.entries.reduce((_, entry) => entry)
const migrationSql = await readFile(
  new URL(`../drizzle/migrations/${latestMigration.tag}.sql`, import.meta.url),
  'utf8',
)
const expectedMigrationHash = createHash('sha256')
  .update(migrationSql)
  .digest('hex')
const expectedMigrationVersion = String(latestMigration.when)

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to verify the Builder schema')
}

const sql = postgres(databaseUrl, {
  connect_timeout: 10,
  idle_timeout: 5,
  max: 1,
})

try {
  const [migrationTable] = await sql<{ relationKind: string | null }[]>`
    select c.relkind::text as "relationKind"
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'drizzle'
      and c.relname = '__drizzle_migrations'
  `

  if (migrationTable?.relationKind !== 'r') {
    throw new Error(
      'Builder database schema is not ready: Drizzle migration history is missing',
    )
  }

  const [appliedMigration] = await sql<{ hash: string; version: string }[]>`
    select hash, created_at::text as version
    from drizzle.__drizzle_migrations
    order by created_at desc, id desc
    limit 1
  `

  if (
    appliedMigration?.hash !== expectedMigrationHash ||
    appliedMigration.version !== expectedMigrationVersion
  ) {
    throw new Error(
      `Builder database migration mismatch: expected ${latestMigration.tag} (${expectedMigrationVersion}, ${expectedMigrationHash})`,
    )
  }

  const invalidRelations = (
    await Promise.all(
      requiredRelations.map(async (relation) => {
        const [result] = await sql<{ relationKind: string | null }[]>`
          select c.relkind::text as "relationKind"
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = ${relation}
        `
        return result?.relationKind === 'r' ? undefined : relation
      }),
    )
  ).filter((relation) => relation !== undefined)

  const invalidTypes = (
    await Promise.all(
      requiredTypes.map(async ({ name, labels }) => {
        const rows = await sql<{ kind: string; label: string }[]>`
          select t.typtype::text as kind, e.enumlabel as label
          from pg_catalog.pg_type t
          join pg_catalog.pg_namespace n on n.oid = t.typnamespace
          left join pg_catalog.pg_enum e on e.enumtypid = t.oid
          where n.nspname = 'public'
            and t.typname = ${name}
          order by e.enumsortorder
        `
        const actualLabels = rows.map((row) => row.label)
        const hasExpectedLabels =
          actualLabels.length === labels.length &&
          actualLabels.every((label, index) => label === labels[index])
        return rows[0]?.kind === 'e' && hasExpectedLabels ? undefined : name
      }),
    )
  ).filter((type) => type !== undefined)

  if (invalidRelations.length > 0 || invalidTypes.length > 0) {
    const invalid = [
      ...invalidRelations.map((relation) => `table ${relation}`),
      ...invalidTypes.map((type) => `enum ${type}`),
    ]
    throw new Error(
      `Builder database schema is not ready: invalid or missing ${invalid.join(', ')}`,
    )
  }

  console.info(
    `Builder database schema matches ${latestMigration.tag} (${expectedMigrationHash})`,
  )
} finally {
  await sql.end()
}
