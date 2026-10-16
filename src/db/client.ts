import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  getDatabaseConnectionString,
  isIsolateRuntime,
  scheduleHostRuntimeTask,
} from '~/server/runtime/host.server'
import * as schema from './schema'

type PostgresClient = ReturnType<typeof postgres>
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
  return postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: !isIsolateRuntime(),
  })
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

  const connectionString = await getDatabaseConnectionString()
  if (!connectionString) {
    return fn()
  }

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
  await client?.end({ timeout: 5 })
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
