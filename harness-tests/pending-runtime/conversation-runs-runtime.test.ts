import type { SqlStorage } from '@cloudflare/workers-types'
import { expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { BotActivityOutbox } from '../../src/chat/server/bot-activity'
import { ConversationStream } from '../../src/chat/server/conversation-stream'
const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}

it('records stable user run identity through actual fixture completion and reconstruction', async () => {
  const h = await conversationHarness()
  const accepted = await h.c.begin(
    h.input('first', 'Synthetic private request'),
  )
  expect(accepted).toMatchObject({
    runId: 'first',
    executionId: expect.any(String),
  })
  expect((accepted as { executionId: string }).executionId).not.toBe('first')
  await h.settle()
  const page = await h.c.runHistory(identity)
  expect(page.items).toHaveLength(1)
  expect(page.items[0]).toMatchObject({
    id: 'first',
    origin: { kind: 'user', messageId: 'first' },
    identity,
    status: 'completed',
    mode: 'assistant',
    startedAt: expect.any(Number),
    completedAt: expect.any(Number),
    assistantTaskId: expect.any(String),
  })
  expect(page.items[0].completedAt!).toBeGreaterThanOrEqual(
    page.items[0].startedAt!,
  )
  expect(JSON.stringify(page)).not.toContain('Synthetic private request')
  const restored = await h.reconstruct()
  expect(await restored.runHistory(identity)).toEqual(page)
  expect((await restored.snapshot()).runs).toEqual(page.items)
})

it('persists queued admission across reconstruction then drains it into the same receipt', async () => {
  const h = await conversationHarness()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  const queued = await h.c.begin(h.input('queued'))
  expect(queued).toMatchObject({ queued: true, messageId: 'queued' })
  const before = (await h.c.runHistory(identity)).items[0]
  expect(before.status).toBe('queued')
  expect(before.startedAt).toBeUndefined()
  expect((await h.c.snapshot()).messages).toHaveLength(0)
  const restored = await h.reconstruct()
  const state = await restored.snapshot()
  expect((await restored.runHistory(identity)).items[0]).toEqual(before)
  await restored.updateQueue({ type: 'resume', version: state.queue!.version })
  await h.settle()
  const after = (await restored.runHistory(identity)).items
  expect(after).toHaveLength(1)
  expect(after[0]).toMatchObject({
    id: 'queued',
    status: 'completed',
    createdAt: before.createdAt,
  })
  expect((await restored.snapshot()).queue!.items).toHaveLength(0)
})

it('cancels deleted queued work without executing it and retains its acceptance receipt', async () => {
  const h = await conversationHarness()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  await h.c.begin(h.input('removed'))
  const state = await h.c.snapshot()
  await h.c.updateQueue({
    type: 'delete',
    id: 'removed',
    version: state.queue!.version,
  })
  expect((await h.c.runHistory(identity)).items[0]).toMatchObject({
    id: 'removed',
    status: 'cancelled',
    completedAt: expect.any(Number),
  })
  expect((await h.c.snapshot()).messages).toHaveLength(0)
  expect(await h.c.begin(h.input('removed'))).toMatchObject({ duplicate: true })
  expect(await h.c.sendReceipt('removed')).toEqual({ accepted: true })
  expect((await h.c.snapshot()).queue!.items).toHaveLength(0)
})

it('keeps durable receipts after reset and blocks duplicate execution with an empty transcript', async () => {
  const h = await conversationHarness()
  await h.c.begin(h.input('once'))
  await h.settle()
  const original = await h.c.runHistory(identity)
  await h.c.reset()
  expect((await h.c.snapshot()).messages).toHaveLength(0)
  expect(await h.c.runHistory(identity)).toEqual(original)
  const restored = await h.reconstruct()
  expect(
    await restored.begin(h.input('once', 'Changed retry text')),
  ).toMatchObject({ duplicate: true })
  await h.settle()
  expect(await restored.sendReceipt('once')).toEqual({ accepted: true })
  expect((await restored.snapshot()).messages).toHaveLength(0)
  expect(await restored.runHistory(identity)).toEqual(original)
})

it('reauthorizes run history and refuses sibling, account, workspace and revoked access', async () => {
  const h = await conversationHarness()
  await h.c.begin(h.input('private'))
  await h.settle()
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('sibling','b',${identity.userId})`
  for (const altered of [
    { ...identity, conversationId: 'sibling' },
    { ...identity, userId: 'other' },
    { ...identity, workspaceId: 'other' },
    { ...identity, botId: 'other' },
  ])
    await expect(h.c.runHistory(altered)).rejects.toThrow()
  await h.db`DELETE FROM chat_memberships WHERE user_id=${identity.userId} AND workspace_id='w'`
  await expect(h.c.runHistory(identity)).rejects.toThrow(
    'Conversation not found',
  )
})

it('does not invent receipts for legacy or copied transcript messages', async () => {
  for (const metadata of [undefined, { gumInherited: true }]) {
    const h = await conversationHarness({
      messages: [
        {
          id: 'old',
          role: 'user',
          parts: [{ type: 'text', content: 'Historical request' }],
          ...(metadata ? { metadata } : {}),
        },
        {
          id: 'answer',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Historical response' }],
        },
      ],
    })
    expect((await h.c.runHistory(identity)).items).toHaveLength(0)
    await h.c.reset()
    expect((await h.c.runHistory(identity)).items).toHaveLength(0)
  }
})

it('queues behind an active fixture run and completes both stable receipts in order', async () => {
  const h = await conversationHarness()
  h.env.GUM_FIXTURE_DELAY_MS = '100'
  await h.c.begin(h.input('active'))
  expect((await h.c.snapshot()).runs[0]).toMatchObject({
    id: 'active',
    status: 'running',
  })
  expect(await h.c.begin(h.input('follow-up'))).toMatchObject({ queued: true })
  const during = (await h.c.runHistory(identity)).items
  expect(during.find((run) => run.id === 'follow-up')!.status).toBe('queued')
  await h.settle()
  const completed = (await h.c.runHistory(identity)).items
  expect(completed).toHaveLength(2)
  expect(completed.every((run) => run.status === 'completed')).toBe(true)
  expect(
    completed.find((run) => run.id === 'follow-up')!.startedAt!,
  ).toBeGreaterThanOrEqual(
    completed.find((run) => run.id === 'active')!.completedAt!,
  )
})

it('records an actual stopped assistant run as interrupted and does not resume it on reconstruction', async () => {
  const h = await conversationHarness()
  h.env.GUM_FIXTURE_DELAY_MS = '10000'
  await h.c.begin(h.input('stopped'))
  await h.c.stop()
  await h.settle()
  const page = await h.c.runHistory(identity)
  expect(page.items[0]).toMatchObject({
    id: 'stopped',
    status: 'interrupted',
    completedAt: expect.any(Number),
  })
  expect((await h.c.snapshot()).turnOutcomes?.stopped).toMatchObject({
    status: 'error',
    termination: 'interrupted',
  })
  const restored = await h.reconstruct()
  expect(await restored.runHistory(identity)).toEqual(page)
  expect((await restored.snapshot()).turnOutcomes?.stopped).toMatchObject({
    status: 'error',
    termination: 'interrupted',
  })
})

it('records a fixture tool-discovery failure without claiming completion', async () => {
  const h = await conversationHarness()
  await h.c.begin({ ...h.input('tool-failure'), proposeToolsOnly: true })
  await h.settle()
  expect((await h.c.runHistory(identity)).items[0]).toMatchObject({
    id: 'tool-failure',
    mode: 'tools',
    status: 'failed',
    completedAt: expect.any(Number),
  })
})

it('records a provider failure as incomplete without putting the raw exception in run history', async () => {
  const h = await conversationHarness()
  ;(h.env as any).AI = {
    run: async () => {
      throw new Error('Synthetic provider failure')
    },
  }
  await h.c.begin({ ...h.input('provider-failure'), fixture: false })
  await h.settle()
  const page = await h.c.runHistory(identity)
  expect(page.items[0]).toMatchObject({
    id: 'provider-failure',
    status: 'incomplete',
    completedAt: expect.any(Number),
  })
  expect(JSON.stringify(page)).not.toContain('Synthetic provider failure')
  expect(
    (await h.c.snapshot()).turnOutcomes?.['provider-failure'],
  ).toMatchObject({ status: 'error', termination: 'incomplete' })
  const restored = await h.reconstruct()
  expect(
    (await restored.snapshot()).turnOutcomes?.['provider-failure'],
  ).toMatchObject({ status: 'error', termination: 'incomplete' })
  await restored.begin(h.input('later-request'))
  await h.settle()
  expect(
    (await restored.snapshot()).turnOutcomes?.['provider-failure'],
  ).toMatchObject({ status: 'error', termination: 'incomplete' })
})

it('leaves the preceding completed receipt unchanged when queued model revalidation fails', async () => {
  const h = await conversationHarness()
  await h.c.begin(h.input('completed'))
  await h.settle()
  const completed = (await h.c.runHistory(identity)).items[0]
  await h.c.updateQueue({
    type: 'pause',
    version: (await h.c.snapshot()).queue!.version,
  })
  await h.c.begin(h.input('blocked'))
  h.env.INCLUDED_MODEL = '@cf/changed-model'
  await h.c.updateQueue({
    type: 'resume',
    version: (await h.c.snapshot()).queue!.version,
  })
  await h.settle()
  const page = await h.c.runHistory(identity)
  expect(page.items.find((run) => run.id === 'completed')).toEqual(completed)
  expect(page.items.find((run) => run.id === 'blocked')!.status).toBe('queued')
  expect((await h.c.snapshot()).queue).toMatchObject({
    paused: true,
    error: expect.any(String),
  })
})

it.each(['assistant', 'system-one', 'tools'] as const)(
  'recovers a durable running %s receipt as interrupted after host loss',
  async (mode) => {
    const { ConversationRuns } =
      await import('../../src/chat/server/conversation-runs')
    const { newAssistantTask } =
      await import('../../src/chat/core/assistant-task')
    const h = await conversationHarness()
    const runs = new ConversationRuns(
      h.ctx.storage.sql as unknown as SqlStorage,
    )
    const assistantTask =
      mode === 'assistant'
        ? newAssistantTask('Synthetic interrupted work', 'crashed')
        : undefined
    runs.accept({
      id: 'crashed',
      identity,
      origin: { kind: 'user', messageId: 'crashed' },
      mode,
      status: 'running',
      createdAt: 1,
      startedAt: 2,
      ...(assistantTask ? { assistantTaskId: assistantTask.id } : {}),
      executionId: 'lost-execution',
    })
    // No live execution is started. Seed the exact durable crash boundary in the
    // initialized database, then construct a new host over that same storage.
    h.local
      .prepare(
        'INSERT INTO state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',
      )
      .run(
        JSON.stringify({
          identity,
          currentRunId: 'crashed',
          status: 'running',
          activeRun: 'lost-execution',
          messages: [
            {
              id: 'crashed',
              role: 'user',
              parts: [{ type: 'text', content: 'Synthetic interrupted work' }],
            },
          ],
          approvals: [],
          traces: [],
          queue: { version: 0, paused: false, items: [] },
          turnTimings: { crashed: { startedAt: 2 } },
          ...(assistantTask ? { assistantTask } : {}),
        }),
      )
    const restored = await h.reconstruct()
    expect((await restored.runHistory(identity)).items[0]).toMatchObject({
      id: 'crashed',
      status: 'interrupted',
      startedAt: 2,
      completedAt: expect.any(Number),
    })
    expect(await restored.begin(h.input('crashed'))).toMatchObject({
      duplicate: true,
    })
    expect((await restored.snapshot()).queue?.paused).toBe(true)
  },
)

it('publishes new transcript updates while sidebar activity publication is blocked', async () => {
  const h = await conversationHarness()
  let releaseActivity = () => {}
  const activityBlocked = new Promise<void>((resolve) => {
    releaseActivity = resolve
  })
  const activity = vi
    .spyOn(BotActivityOutbox.prototype, 'flush')
    .mockImplementationOnce(() => activityBlocked)
  const stream = vi.spyOn(ConversationStream.prototype, 'flush')
  try {
    await h.c.updateQueue({ type: 'pause', version: 0 })
    const firstPublication = stream.mock.calls.length
    expect(firstPublication).toBeGreaterThan(0)
    await h.c.updateQueue({ type: 'resume', version: 1 })
    expect(stream.mock.calls.length).toBeGreaterThan(firstPublication)
  } finally {
    releaseActivity()
    await h.settle()
    activity.mockRestore()
    stream.mockRestore()
  }
})
