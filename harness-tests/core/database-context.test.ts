import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'

const runtime = vi.hoisted(() => {
  const clients: Array<{ execute: ReturnType<typeof vi.fn> }> = []
  return {
    isolate: true,
    connectionString: 'postgres://test.invalid/database',
    clients,
  }
})

vi.mock('~/server/runtime/host.server', () => ({
  isIsolateRuntime: () => runtime.isolate,
  getDatabaseConnectionString: async () => runtime.connectionString,
}))
vi.mock('postgres', () => ({
  default: vi.fn(() => {
    const client = { execute: vi.fn(async () => []) }
    runtime.clients.push(client)
    return client
  }),
}))
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (client: { execute: ReturnType<typeof vi.fn> }) => client,
}))

import { db, runWithDatabaseContext } from '~/db/client'

beforeEach(() => {
  runtime.clients.length = 0
})

describe('Cloudflare database context', () => {
  it('does not open a connection when the invocation does not query', async () => {
    await runWithDatabaseContext(async () => undefined)
    expect(runtime.clients).toHaveLength(0)
  })

  it('reuses the same client in nested work', async () => {
    await runWithDatabaseContext(async () => {
      await db.execute(sql`select 1`)
      await runWithDatabaseContext(async () => db.execute(sql`select 2`))
    })
    expect(runtime.clients).toHaveLength(1)
    expect(runtime.clients[0].execute).toHaveBeenCalledTimes(2)
  })

  it('isolates clients between concurrent invocations', async () => {
    await Promise.all([
      runWithDatabaseContext(async () => db.execute(sql`select 1`)),
      runWithDatabaseContext(async () => db.execute(sql`select 2`)),
    ])
    expect(runtime.clients).toHaveLength(2)
    for (const client of runtime.clients)
      expect(client.execute).toHaveBeenCalledTimes(1)
  })

  it('retains the invocation context for work continuing after its response', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let background = Promise.resolve()
    await runWithDatabaseContext(async () => {
      await db.execute(sql`select 1`)
      background = gate.then(async () => {
        await db.execute(sql`select 2`)
      })
    })
    expect(runtime.clients).toHaveLength(1)
    release()
    await background
    expect(runtime.clients).toHaveLength(1)
    expect(runtime.clients[0].execute).toHaveBeenCalledTimes(2)
  })
})
