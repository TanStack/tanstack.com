import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ decide: vi.fn(), rank: vi.fn() }))
vi.mock('@tanstack/ai', async (original) => ({
  ...(await original<object>()),
  decide: mocks.decide,
}))
vi.mock('../../src/chat/server/batched-ranking.ts', () => ({
  rankWithJevBatches: mocks.rank,
}))
import {
  selectTaskStep,
  aggregateTaskUsage,
} from '../../src/chat/server/jev-task-decisions'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entries: CatalogEntry[] = Array.from({ length: 40 }, (_, index) => ({
  id: String(index),
  serverId: 'test',
  serverLabel: 'Test',
  name: 'operation_' + index,
  title: 'Operation',
  description: 'Read records',
  kind: 'tool',
  target: { method: 'tools/call', name: 'operation_' + index },
}))
const state = {
  request: 'Read records',
  observations: [
    {
      id: 'one',
      toolId: '0',
      toolName: 'operation_0',
      arguments: {},
      ok: true,
      value: { records: ['A'] },
    },
  ],
  unresolved: [],
}
const env = { TYPESAFE_API_KEY: 'test' }
const signal = new AbortController().signal
it('compacts only ranking results while keeping complete evidence for final selection', async () => {
  const { jevTaskInference } =
    await import('../../src/chat/server/jev-task-decisions')
  mocks.rank.mockResolvedValue({ ranking: [{ id: '1' }], trace: [] })
  mocks.decide.mockResolvedValue({
    next: { value: 'tool_0' },
    meta: { usage: {} },
  })
  const input = {
    ...state,
    context: [{ request: 'Earlier lookup', observations: state.observations }],
  }
  const before = JSON.stringify(input)
  await jevTaskInference(env, { compactRankingState: true }).select(
    input,
    entries,
    signal,
  )
  const ranked = JSON.parse(mocks.rank.mock.calls[0][0])
  expect(ranked.observations[0]).not.toHaveProperty('value')
  expect(ranked.observations[0].result).toEqual({
    omittedForRanking: true,
    type: 'object',
    keys: ['records'],
  })
  expect(ranked.context[0].observations[0]).not.toHaveProperty('value')
  expect(ranked.request).toBe(input.request)
  expect(mocks.decide.mock.calls[0][0].state).toEqual(input)
  expect(JSON.stringify(input)).toBe(before)
})
beforeEach(() => {
  vi.clearAllMocks()
})
it('can finish from evidence before paying for full catalog ranking', async () => {
  mocks.decide.mockResolvedValue({
    complete: { value: 'done', probability: 0.9, confidence: 0.9 },
    meta: { usage: { totalTokens: 100 }, model: 'test' },
  })
  expect(
    (await selectTaskStep(state, entries, env, signal, true)).decision,
  ).toEqual({ type: 'done' })
  expect(mocks.rank).not.toHaveBeenCalled()
  expect(mocks.decide.mock.calls[0][0].state.observedContracts).toHaveLength(1)
})
it('continues normal selection when completion is not established', async () => {
  mocks.decide
    .mockResolvedValueOnce({
      complete: { value: 'continue' },
      meta: { usage: {} },
    })
    .mockResolvedValueOnce({ next: { value: 'tool_0' }, meta: { usage: {} } })
  mocks.rank.mockResolvedValue({ ranking: [{ id: '1' }], trace: [] })
  expect(
    (await selectTaskStep(state, entries, env, signal, true)).decision,
  ).toEqual({ type: 'tool', id: '1' })
  expect(mocks.rank).toHaveBeenCalledOnce()
})
it('does not use a completion shortcut without successful evidence', async () => {
  mocks.rank.mockResolvedValue({ ranking: [{ id: '1' }], trace: [] })
  mocks.decide.mockResolvedValue({
    next: { value: 'tool_0' },
    meta: { usage: {} },
  })
  await selectTaskStep(
    { ...state, observations: [] },
    entries,
    env,
    signal,
    true,
  )
  expect(mocks.rank).toHaveBeenCalledOnce()
  expect(mocks.decide.mock.calls[0][0].questions).not.toHaveProperty('complete')
})
it('aggregates reported usage while preserving unknown cost and incomplete token counts', () => {
  expect(
    aggregateTaskUsage([
      { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      [{ promptTokens: 4, completionTokens: 1, totalTokens: 5 }],
    ]),
  ).toEqual({
    promptTokens: 6,
    completionTokens: 2,
    totalTokens: 8,
    cost: undefined,
  })
  expect(
    aggregateTaskUsage([{ totalTokens: 3 }, {}]).totalTokens,
  ).toBeUndefined()
})

it('does not hide missing usage from rejected provider attempts', () => {
  expect(
    aggregateTaskUsage([{ totalTokens: 100 }, undefined]).totalTokens,
  ).toBeUndefined()
})

it('can refine a terminal explanation without selecting or executing another operation', async () => {
  mocks.decide
    .mockResolvedValueOnce({
      next: { value: 'needs_input', probability: 0.7 },
      meta: { usage: { totalTokens: 50 } },
    })
    .mockResolvedValueOnce({
      reason: { value: 'missing_capability', probability: 0.99 },
      meta: { usage: { totalTokens: 30 } },
    })
  const result = await selectTaskStep(
    { request: 'An unavailable action', observations: [], unresolved: [] },
    entries.slice(0, 1),
    env,
    signal,
    false,
    true,
  )
  expect(result.decision).toEqual({ type: 'unsupported' })
  expect(result.terminalClassification?.probability).toBe(0.99)
  expect(result.usage).toHaveLength(2)
  expect(mocks.rank).not.toHaveBeenCalled()
})

it('keeps same-name tools distinguishable by server and returns the selected identity', async () => {
  const twins = ['Personal Vault', 'Team Archive'].map(
    (serverLabel, index) => ({
      ...entries[0],
      id: `server-${index}:read`,
      serverId: `server-${index}`,
      serverLabel,
      name: 'read_record',
      description: 'Read a record by ID.',
    }),
  )
  mocks.decide.mockImplementation(async (input) => {
    const choices = input.questions.next.criteria
    const personal = JSON.parse(choices.tool_0)
    const team = JSON.parse(choices.tool_1)
    expect(personal.name).toBe(team.name)
    expect(personal.serverLabel).toBe('Personal Vault')
    expect(team.serverLabel).toBe('Team Archive')
    expect(personal.id).not.toBe(team.id)
    return { next: { value: 'tool_1' }, meta: { usage: {} } }
  })
  const result = await selectTaskStep(
    { request: 'Read R-7 from Team Archive', observations: [], unresolved: [] },
    twins,
    env,
    signal,
  )
  expect(result.decision).toEqual({ type: 'tool', id: twins[1].id })
})

it('audits proposed completion and reselects without a done option when verification is missing', async () => {
  const { jevTaskInference } =
    await import('../../src/chat/server/jev-task-decisions')
  mocks.decide
    .mockResolvedValueOnce({
      complete: { value: 'done' },
      meta: { usage: { totalTokens: 10 } },
    })
    .mockResolvedValueOnce({
      verification: { value: 'missing' },
      meta: { usage: { totalTokens: 20 } },
    })
    .mockResolvedValueOnce({
      next: { value: 'tool_0' },
      meta: { usage: { totalTokens: 30 } },
    })
  const input = {
    ...state,
    observations: [{ ...state.observations[0], effect: 'write' as const }],
  }
  const before = JSON.stringify(input)
  const result = await jevTaskInference(env, {
    completionFirst: true,
    completionAudit: true,
  }).select(input, entries.slice(0, 1), signal)
  expect(result.decision).toEqual({ type: 'tool', id: '0' })
  expect(aggregateTaskUsage(result.usage).totalTokens).toBe(60)
  const retry = mocks.decide.mock.calls[2][0]
  expect(retry.state.verificationAudit.missingObservationIds).toEqual(['one'])
  expect(retry.questions.next.criteria).not.toHaveProperty('done')
  expect(JSON.stringify(input)).toBe(before)
})

it('accepts completion when no successful non-read actions need auditing', async () => {
  const { jevTaskInference } =
    await import('../../src/chat/server/jev-task-decisions')
  mocks.decide.mockResolvedValueOnce({
    complete: { value: 'done' },
    meta: { usage: { totalTokens: 10 } },
  })
  const result = await jevTaskInference(env, {
    completionFirst: true,
    completionAudit: true,
  }).select(
    { ...state, observations: [{ ...state.observations[0], effect: 'read' }] },
    entries,
    signal,
  )
  expect(result.decision).toEqual({ type: 'done' })
  expect(mocks.decide).toHaveBeenCalledOnce()
})

it('counts shared batched audit usage once for multiple actions', async () => {
  const { jevTaskInference } =
    await import('../../src/chat/server/jev-task-decisions')
  mocks.decide
    .mockResolvedValueOnce({
      complete: { value: 'done' },
      meta: { usage: { totalTokens: 10 } },
    })
    .mockResolvedValueOnce({
      action_0: { value: 'satisfied' },
      action_1: { value: 'not_required' },
      meta: { usage: { totalTokens: 20 } },
    })
  const result = await jevTaskInference(env, {
    completionFirst: true,
    completionAudit: 'batch',
  }).select(
    {
      ...state,
      observations: [
        { ...state.observations[0], effect: 'write' },
        { ...state.observations[0], id: 'two', effect: 'write' },
      ],
    },
    entries.slice(0, 1),
    signal,
  )
  expect(result.decision).toEqual({ type: 'done' })
  expect(aggregateTaskUsage(result.usage).totalTokens).toBe(30)
  expect(mocks.decide).toHaveBeenCalledTimes(2)
  expect(Object.keys(mocks.decide.mock.calls[1][0].questions)).toEqual([
    'action_0',
    'action_1',
  ])
  expect(
    mocks.decide.mock.calls[1][0].state.observations.map(
      (o: { index: number }) => o.index,
    ),
  ).toEqual([0, 1])
})

it('splits large audits without dropping observations or duplicating usage', async () => {
  const { auditTaskVerification } =
    await import('../../src/chat/server/jev-verification')
  mocks.decide.mockImplementation(async ({ questions }) => ({
    ...Object.fromEntries(
      Object.keys(questions).map((key) => [key, { value: 'not_required' }]),
    ),
    meta: { usage: { totalTokens: 100 } },
  }))
  const observations = Array.from({ length: 33 }, (_, i) => ({
    ...state.observations[0],
    id: 'event_' + i,
    effect: 'write' as const,
  }))
  const result = await auditTaskVerification(
    { ...state, observations },
    entries.slice(0, 1),
    env,
    signal,
    'batch',
  )
  expect(result.audits).toHaveLength(33)
  expect(result.audits.map((a) => a.observationId)).toEqual(
    observations.map((o) => o.id),
  )
  expect(result.usage).toHaveLength(2)
  expect(
    mocks.decide.mock.calls.map(
      ([input]) => Object.keys(input.questions).length,
    ),
  ).toEqual([32, 1])
  for (const [input] of mocks.decide.mock.calls)
    expect(input.state.observations).toHaveLength(33)
})

it('rejects oversized audit evidence before inference', async () => {
  const { auditTaskVerification } =
    await import('../../src/chat/server/jev-verification')
  const input = {
    ...state,
    observations: [
      {
        ...state.observations[0],
        effect: 'write' as const,
        value: 'x'.repeat(96000),
      },
    ],
  }
  await expect(
    auditTaskVerification(input, entries.slice(0, 1), env, signal, 'batch'),
  ).rejects.toThrow('byte budget')
  expect(mocks.decide).not.toHaveBeenCalled()
})
