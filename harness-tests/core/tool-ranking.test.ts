import { it, expect, vi, beforeEach } from 'vitest'
const mocks = vi.hoisted(() => ({ decide: vi.fn() }))
vi.mock('@tanstack/ai', async (original) => ({
  ...(await original<object>()),
  decide: mocks.decide,
}))
import { rankDiscoveredTools } from '../../src/chat/server/tool-proposals'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entries: CatalogEntry[] = ['b', 'a', 'c'].map((id) => ({
  id,
  name: id,
  title: id,
  description: id,
  serverId: 's',
  serverLabel: 'S',
  kind: 'tool',
  target: { method: 'tools/call', name: id },
}))
const env = { TYPESAFE_API_KEY: 'test' }
beforeEach(() => mocks.decide.mockReset())
it('scores every candidate and selects by raw score, preserving usage', async () => {
  mocks.decide.mockResolvedValue({
    candidate_0: { score: 1 },
    candidate_1: {
      score: 2.7,
      confidence: 0.6,
      probability: 0.7,
      probabilities: { '2': 0.3, '3': 0.7 },
      value: 'Useful step',
      legend: { '3': 'Useful step' },
    },
    candidate_2: { score: 2.6 },
    meta: { model: 'jev-version', usage: { totalTokens: 50 } },
  })
  const r = await rankDiscoveredTools(
    'request',
    entries,
    env,
    new AbortController().signal,
  )
  expect(r.selected?.id).toBe('a')
  expect(r.ranking.map((e) => e.id)).toEqual(['a', 'c', 'b'])
  expect(r.usage).toEqual({ totalTokens: 50 })
  expect(r.model).toBe('jev-version')
  expect(r.ranking[0]).toMatchObject({
    confidence: 0.6,
    probability: 0.7,
    probabilities: { '2': 0.3, '3': 0.7 },
    legend: { '3': 'Useful step' },
  })
  expect(r.ranking[1].confidence).toBeNull()
  expect(
    Object.values(mocks.decide.mock.calls[0][0].questions).every(
      (q: any) => q.type === 'score',
    ),
  ).toBe(true)
})
it('breaks exact ties by stable identity rather than source order', async () => {
  mocks.decide.mockResolvedValue({
    candidate_0: { score: 0 },
    candidate_1: { score: 0 },
    candidate_2: { score: 0 },
    meta: { usage: {} },
  })
  for (const catalog of [entries, [...entries].reverse()]) {
    const r = await rankDiscoveredTools(
      'request',
      catalog,
      env,
      new AbortController().signal,
    )
    expect(r.selected?.id).toBe('a')
    expect(r.score).toBe(0)
  }
})
it.each([undefined, NaN, Infinity, -1, 4.1])(
  'rejects missing or invalid scores: %s',
  async (score) => {
    mocks.decide.mockResolvedValue({
      candidate_0: { score },
      meta: { usage: {} },
    })
    await expect(
      rankDiscoveredTools(
        'request',
        [entries[0]],
        env,
        new AbortController().signal,
      ),
    ).rejects.toThrow('invalid relevance score')
  },
)
it('skips inference on empty catalogs and aborted requests', async () => {
  const r = await rankDiscoveredTools(
    'request',
    [],
    env,
    new AbortController().signal,
  )
  expect(r.selected).toBeNull()
  await expect(
    rankDiscoveredTools('request', entries, env, AbortSignal.abort()),
  ).rejects.toThrow()
  expect(mocks.decide).not.toHaveBeenCalled()
})

it('can evaluate next-step suitability separately from relevance without changing the default', async () => {
  mocks.decide.mockResolvedValue({
    candidate_0: { score: 3 },
    relevance_0: { score: 2.5 },
    candidate_1: { score: 3 },
    relevance_1: { score: 4 },
    candidate_2: { score: 2 },
    relevance_2: { score: 4 },
    meta: {},
  })
  const r = await rankDiscoveredTools(
    'request',
    entries,
    env,
    new AbortController().signal,
    'dual',
  )
  expect(r.selected?.id).toBe('a')
  expect(r.ranking[0].relevance?.score).toBe(4)
  const questions = mocks.decide.mock.calls[0][0].questions
  expect(Object.keys(questions)).toHaveLength(6)
  expect(questions.candidate_0.instructions).toContain('NEXT proposed step')
  expect(questions.relevance_0.instructions).toContain('how useful')
})
