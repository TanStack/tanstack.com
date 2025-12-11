import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create the connection string from environment variable
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create postgres client
// For serverless environments, use connection pooling
const client = postgres(connectionString, {
  max: 1, // For serverless, limit connections
  idle_timeout: 20,
  connect_timeout: 10,
})

// Create drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema for use in migrations and queries
export { schema }
