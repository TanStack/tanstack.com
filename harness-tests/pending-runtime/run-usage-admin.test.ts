import { expect, it } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import {
  reserveRunUsage,
  settleFundedSpend,
  fundedSpendPolicy,
  type ReserveRunUsageInput,
} from '../../src/chat/server/run-usage'

const input: ReserveRunUsageInput = {
  identity: {
    workspaceId: 'w',
    botId: 'b',
    conversationId: 'main-conversation',
    userId: '00000000-0000-4000-8000-000000000001',
  },
  runId: 'admin-run',
  policy: { dailyTurns: 20 },
  localDevelopment: false,
  scheduled: false,
  fundedSpend: fundedSpendPolicy,
  now: Date.UTC(2026, 9, 4),
}

it('uses the stored role at admission, preserves admin accounting and rechecks revocation', async () => {
  const h = await conversationHarness()
  await h.db`INSERT INTO chat_funded_spend(conversation_id,run_id,user_id,day,reserved_micros,billed_micros) VALUES('main-conversation','prior',${input.identity.userId},'2026-10-04',20000000,20000000)`
  await expect(reserveRunUsage(input)).rejects.toMatchObject({
    code: 'user-spend',
  })
  await h.db`UPDATE users SET capabilities=ARRAY['admin']::capability[] WHERE id=${input.identity.userId}`
  await expect(reserveRunUsage(input)).resolves.toMatchObject({
    status: 'reserved',
  })
  await expect(reserveRunUsage(input)).resolves.toMatchObject({
    status: 'duplicate',
  })
  expect(
    await h.db`SELECT run_id FROM chat_run_usage_receipts WHERE run_id='admin-run'`,
  ).toHaveLength(1)
  const [reserved] =
    await h.db`SELECT reserved_micros,billed_micros FROM chat_funded_spend WHERE run_id='admin-run'`
  expect(Number(reserved.reserved_micros)).toBe(250_000)
  expect(Number(reserved.billed_micros)).toBe(250_000)
  await settleFundedSpend('main-conversation', 'admin-run', 0.01, false)
  const [settled] =
    await h.db`SELECT billed_micros,observed_micros FROM chat_funded_spend WHERE run_id='admin-run'`
  expect(Number(settled.billed_micros)).toBe(10_000)
  expect(Number(settled.observed_micros)).toBe(10_000)
  expect(
    await h.db`SELECT user_id FROM chat_daily_usage WHERE day='2026-10-04' AND turns=1`,
  ).toHaveLength(2)
  await h.db`UPDATE users SET capabilities='{}'::capability[] WHERE id=${input.identity.userId}`
  await expect(
    reserveRunUsage({ ...input, runId: 'revoked-run' }),
  ).rejects.toMatchObject({ code: 'user-spend' })
})

it('recognizes an assigned admin role and rechecks removal of that assignment', async () => {
  const h = await conversationHarness()
  await h.db`INSERT INTO chat_funded_spend(conversation_id,run_id,user_id,day,reserved_micros,billed_micros) VALUES('main-conversation','prior',${input.identity.userId},'2026-10-04',20000000,20000000)`
  const [role] =
    await h.db`INSERT INTO roles(id,capabilities) VALUES(${crypto.randomUUID()},ARRAY['admin']::capability[]) RETURNING id`
  await h.db`INSERT INTO role_assignments(id,user_id,role_id) VALUES(${crypto.randomUUID()},${input.identity.userId},${role.id})`
  await expect(reserveRunUsage(input)).resolves.toMatchObject({
    status: 'reserved',
  })
  await h.db`DELETE FROM role_assignments WHERE user_id=${input.identity.userId}`
  await expect(
    reserveRunUsage({ ...input, runId: 'removed-role' }),
  ).rejects.toMatchObject({ code: 'user-spend' })
})

it('uses authentication parsing for text-backed capability columns', async () => {
  const h = await conversationHarness()
  const tables = ['users', 'roles']
  try {
    for (const table of tables)
      await h.db.unsafe(
        `ALTER TABLE "${table}" ALTER COLUMN capabilities DROP DEFAULT, ALTER COLUMN capabilities TYPE text USING capabilities::text, ALTER COLUMN capabilities SET DEFAULT '{}'`,
      )
    await h.db`UPDATE users SET capabilities='{admin}' WHERE id=${input.identity.userId}`
    await h.db`INSERT INTO chat_funded_spend(conversation_id,run_id,user_id,day,reserved_micros,billed_micros) VALUES('main-conversation','prior',${input.identity.userId},'2026-10-04',20000000,20000000)`
    await expect(reserveRunUsage(input)).resolves.toMatchObject({
      status: 'reserved',
    })
  } finally {
    for (const table of tables)
      await h.db.unsafe(
        `ALTER TABLE "${table}" ALTER COLUMN capabilities DROP DEFAULT, ALTER COLUMN capabilities TYPE capability[] USING capabilities::capability[], ALTER COLUMN capabilities SET DEFAULT '{}'::capability[]`,
      )
  }
})

it('increments both daily counters once for concurrent reservations and duplicate receipts', async () => {
  const h = await conversationHarness()
  const runs = Array.from({ length: 4 }, (_, index) => ({
    ...input,
    fundedSpend: undefined,
    runId: `concurrent-counter-${index}`,
  }))
  await Promise.all(
    runs.flatMap((run) => [reserveRunUsage(run), reserveRunUsage(run)]),
  )
  const counters =
    await h.db`SELECT user_id,turns FROM chat_daily_usage WHERE day='2026-10-04' ORDER BY user_id`
  expect(
    counters.map((row) => ({ userId: row.user_id, turns: Number(row.turns) })),
  ).toEqual([
    { userId: input.identity.userId, turns: 4 },
    { userId: '__global', turns: 4 },
  ])
  await expect(
    reserveRunUsage({
      ...runs[0],
      runId: 'rejected-counter',
      policy: { dailyTurns: 4 },
    }),
  ).rejects.toMatchObject({ code: 'user' })
  expect(
    await h.db`SELECT run_id FROM chat_run_usage_receipts WHERE run_id='rejected-counter'`,
  ).toHaveLength(0)
  expect(
    await h.db`SELECT turns FROM chat_daily_usage WHERE day='2026-10-04' AND turns=4`,
  ).toHaveLength(2)
})
