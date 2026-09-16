import postgres from 'postgres'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import type { Execute } from './queries'
export async function dashboardDatabaseUrl() {
  const env = await getHostRuntimeEnv()
  const hyperdrive = env?.DASHBOARD_HYPERDRIVE
  if (
    hyperdrive &&
    typeof hyperdrive === 'object' &&
    'connectionString' in hyperdrive &&
    typeof hyperdrive.connectionString === 'string'
  )
    return hyperdrive.connectionString
  const url = env?.DASHBOARD_DATABASE_URL ?? process.env.DASHBOARD_DATABASE_URL
  if (typeof url !== 'string' || !url)
    throw new Error(
      'Set the dedicated dashboard database connection before opening server mode.',
    )
  return url
}
export async function withDatabase<T>(read: (execute: Execute) => Promise<T>) {
  const url = await dashboardDatabaseUrl()
  const sql = postgres(url, {
    max: 1,
    fetch_types: false,
    connect_timeout: 10,
    idle_timeout: 5,
  })
  const started = performance.now()
  let queryCount = 0
  let succeeded = false
  try {
    const result = await sql.begin(
      'isolation level repeatable read read only',
      async (transaction) => {
        await transaction.unsafe("SET LOCAL statement_timeout = '15s'")
        const execute: Execute = async (query, values) => {
          queryCount++
          return Array.from(await transaction.unsafe(query, values))
        }
        return read(execute)
      },
    )
    succeeded = true
    return result
  } catch {
    throw new Error('Dashboard data is temporarily unavailable. Please retry.')
  } finally {
    console.info(
      JSON.stringify({
        event: 'dashboard.database',
        durationMs: Math.round(performance.now() - started),
        queryCount,
        succeeded,
      }),
    )
    await sql.end()
  }
}
