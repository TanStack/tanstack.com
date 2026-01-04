import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy initialization to avoid throwing at module load time
let _client: ReturnType<typeof postgres> | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    _client = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    })
    _db = drizzle(_client, { schema })
  }
  return _db
}

// Use a getter to lazily initialize db on first access
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop, receiver) {
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
