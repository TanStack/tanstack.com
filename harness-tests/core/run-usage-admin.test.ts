import { beforeEach, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  capabilities: vi.fn(),
}))
vi.mock('~/db/client', () => ({ db: mocks }))
vi.mock('~/auth/repositories.server', () => ({
  DrizzleCapabilitiesRepository: class {
    getEffectiveCapabilities = mocks.capabilities
  },
}))
import {
  reserveRunUsage,
  settleFundedSpend,
  type ReserveRunUsageInput,
} from '../../src/chat/server/run-usage'

const dialect = new PgDialect()
const queries: { sql: string; params: unknown[] }[] = []
const usage = {
  user_turns: 1,
  global_turns: 1,
  scheduled_turns: 0,
  user_spend: 2_000_000,
  global_spend: 20_000_000,
  user_is_admin: false,
}
const input: ReserveRunUsageInput = {
  identity: {
    workspaceId: 'workspace',
    botId: 'bot',
    conversationId: 'room',
    userId: '877728d5-9673-4b29-b330-6b110d447c53',
  },
  runId: 'run',
  policy: { dailyTurns: 20 },
  localDevelopment: false,
  scheduled: false,
  fundedSpend: {
    userCapMicros: 2_000_000,
    globalCapMicros: 20_000_000,
    reservationMicros: 250_000,
  },
}

beforeEach(() => {
  queries.length = 0
  Object.assign(usage, {
    user_turns: 1,
    global_turns: 1,
    scheduled_turns: 0,
    user_spend: 2_000_000,
    global_spend: 20_000_000,
    user_is_admin: false,
  })
  mocks.capabilities.mockReset()
  mocks.capabilities.mockImplementation(async () =>
    usage.user_is_admin ? ['admin'] : [],
  )
  mocks.execute.mockReset()
  mocks.execute.mockImplementation(async (statement: SQL) => {
    const query = dialect.sqlToQuery(statement)
    queries.push(query)
    if (query.sql.includes('AS user_turns')) return [usage]
    if (query.sql.includes('SELECT day FROM chat_funded_spend'))
      return [{ day: '2026-10-04' }]
    return []
  })
  mocks.transaction.mockImplementation((work) =>
    work({ execute: mocks.execute }),
  )
})

it('admits a stored admin above both spending caps while retaining billing and turn receipts', async () => {
  usage.user_is_admin = true
  await expect(reserveRunUsage(input)).resolves.toMatchObject({
    status: 'reserved',
  })
  expect(mocks.capabilities).toHaveBeenCalledWith(
    input.identity.userId,
    expect.objectContaining({ execute: mocks.execute }),
  )
  expect(
    queries.some((query) =>
      query.sql.includes('INSERT INTO chat_run_usage_receipts'),
    ),
  ).toBe(true)
  expect(
    queries.some(
      (query) =>
        query.sql.includes('INSERT INTO chat_funded_spend') &&
        query.params.includes(250_000),
    ),
  ).toBe(true)
  expect(
    queries.filter((query) =>
      query.sql.includes('INSERT INTO chat_daily_usage'),
    ),
  ).toHaveLength(1)
  await settleFundedSpend('room', 'run', 0.01, false)
  expect(
    queries.some(
      (query) =>
        query.sql.includes('UPDATE chat_funded_spend') &&
        query.params.includes(10_000),
    ),
  ).toBe(true)
})

it('continues rejecting a regular account at its included spending cap', async () => {
  await expect(reserveRunUsage(input)).rejects.toMatchObject({
    code: 'user-spend',
  })
  expect(queries.some((query) => query.sql.includes('INSERT INTO'))).toBe(false)
})

it('continues rejecting a regular account at the shared included spending cap', async () => {
  usage.user_spend = 0
  await expect(reserveRunUsage(input)).rejects.toMatchObject({
    code: 'global-spend',
  })
})

it.each([
  ['user_turns', 20, 'user'],
  ['global_turns', 300, 'global'],
  ['scheduled_turns', 20, 'scheduled'],
] as const)('retains %s limits for admins', async (field, value, code) => {
  usage.user_is_admin = true
  usage[field] = value
  await expect(
    reserveRunUsage({ ...input, scheduled: true }),
  ).rejects.toMatchObject({ code })
})

it('avoids resolving admin capabilities when no funded cap applies', async () => {
  await expect(
    reserveRunUsage({ ...input, fundedSpend: undefined }),
  ).resolves.toMatchObject({ status: 'reserved' })
  expect(mocks.capabilities).not.toHaveBeenCalled()
})
