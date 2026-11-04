import {
  markRequestDatabaseUse,
  timeRequestWork,
} from '../utils/request-timing.server'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { databaseFailureKind } from './errors'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  getDatabaseConnectionString,
  isIsolateRuntime,
  scheduleHostRuntimeTask,
} from '~/server/runtime/host.server'
import * as schema from './schema'

type PostgresClient = Pool
type Database = ReturnType<typeof drizzle<typeof schema>>
type DatabaseContext = {
  client?: PostgresClient
  connectionString: string
  db?: Database
  active: number
}

// Lazy initialization to avoid throwing at module load time
let _client: PostgresClient | null = null
let _db: Database | null = null
const databaseStorage = new AsyncLocalStorage<DatabaseContext>()

function createPostgresClient(connectionString: string) {
  // Drizzle's Postgres.js adapter disables prepared statements, which is not
  // supported by Hyperdrive. Use its supported node-postgres adapter instead.
  const client = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  })
  // Idle clients can lose their connection between queries. pg removes them
  // from the pool; handle the event so it cannot crash the process.
  client.on('error', (error) =>
    console.warn('Idle database connection lost', {
      kind: databaseFailureKind(error),
    }),
  )
  return client
}

function createDatabase(connectionString: string) {
  const client = createPostgresClient(connectionString)
  return {
    client,
    db: drizzle(client, { schema }),
  }
}

function getDatabaseUrl() {
  const context = databaseStorage.getStore()
  const connectionString = context?.connectionString ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return connectionString
}

export async function isDatabaseConfigured() {
  return Boolean(await getDatabaseConnectionString())
}

function getRequestDb(context: DatabaseContext) {
  if (!context.db) {
    const database = createDatabase(context.connectionString)
    context.client = database.client
    context.db = database.db
  }

  return context.db
}

function getDb() {
  markRequestDatabaseUse()
  const context = databaseStorage.getStore()
  if (context) {
    return getRequestDb(context)
  }

  if (isIsolateRuntime()) {
    return createDatabase(getDatabaseUrl()).db
  }

  if (!_db) {
    const database = createDatabase(getDatabaseUrl())
    _client = database.client
    _db = database.db
  }
  return _db
}

export async function runWithDatabaseContext<T>(
  fn: () => Promise<T>,
): Promise<T> {
  if (databaseStorage.getStore() || !isIsolateRuntime()) {
    return fn()
  }

  const connectionString = await timeRequestWork(
    'db_config',
    getDatabaseConnectionString,
  )
  if (!connectionString) {
    return fn()
  }
  if (
    import.meta.env.MODE === 'staging' &&
    new URL(connectionString).hostname !==
      'ep-blue-rice-b4fz0smd-pooler.c-6.us-east-2.aws.neon.tech'
  )
    throw new Error('Staging can only connect to its isolated database')

  const context: DatabaseContext = { connectionString, active: 1 }
  return databaseStorage.run(context, async () => {
    try {
      return await fn()
    } finally {
      await releaseDatabaseContext(context)
    }
  })
}

async function releaseDatabaseContext(context: DatabaseContext) {
  if (--context.active) return
  const client = context.client
  // Async runtime frames can outlive an invocation. They must not retain the
  // database schema and connection pool after all of its work has completed.
  context.client = undefined
  context.db = undefined
  if (client) await timeRequestWork('db_connection_close', () => client.end())
}

export function retainDatabaseContext<T>(work: Promise<T>): Promise<T> {
  const context = databaseStorage.getStore()
  if (!context) return work
  context.active++
  return work.finally(() => releaseDatabaseContext(context))
}

export function runWithDatabaseRequest(fn: () => Promise<Response>) {
  return runWithDatabaseContext(async () => {
    const response = await fn()
    const body = response.body
    if (!databaseStorage.getStore() || !body) return response
    // SSR can keep querying after returning its response headers. Retain its
    // database until the streamed body finishes or the client disconnects.
    const stream = new TransformStream<Uint8Array, Uint8Array>()
    scheduleHostRuntimeTask(() =>
      body.pipeTo(stream.writable).catch(() => {
        // The readable side already reports the stream error to the client.
      }),
    )
    return new Response(stream.readable, response)
  })
}

// Use a getter to lazily initialize db on first access
export const db = new Proxy({} as Database, {
  get(_target, prop, _receiver) {
    const realDb = getDb()
    const value = Reflect.get(realDb, prop, realDb)
    if (typeof value === 'function') {
      return value.bind(realDb)
    }
    return value
  },
})

// Export schema for use in migrations and queries
export { schema }
