import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ decide: vi.fn() }))
vi.mock('@tanstack/ai', async (original) => ({
  ...(await original<object>()),
  decide: mocks.decide,
}))
import {
  collectAnswerPassages,
  renderAnswerEvidence,
  selectAnswerEvidence,
} from '../../src/chat/server/answer-evidence'
import type { TaskObservation } from '../../src/chat/server/system-one-loop'
const observation: TaskObservation = {
  id: 'one',
  toolId: 'lookup',
  toolName: 'Lookup',
  source: { serverId: 'test', serverLabel: 'Test', kind: 'tool' },
  arguments: { query: 'Maple' },
  ok: true,
  value: {
    rows: [
      {
        content: 'Maple opens at 09:00.\nIt closes at 17:00.',
        extra: { version: 1 },
      },
    ],
  },
}
const input = {
  request: 'When does Maple open?',
  observations: [observation],
  env: { TYPESAFE_API_KEY: 'unused' },
  signal: new AbortController().signal,
}
beforeEach(() => {
  mocks.decide.mockReset()
})
it('selects only exact observed text and preserves source, pointer and offsets', async () => {
  mocks.decide.mockImplementation(async ({ state }) => {
    const id = state.passages.find(
      (p: { text: string }) => p.text === 'Maple opens at 09:00.',
    ).id
    return { evidence: { value: id }, meta: { usage: { totalTokens: 10 } } }
  })
  const result = await selectAnswerEvidence(input)
  expect(result).toMatchObject({
    status: 'selected',
    passage: {
      observationId: 'one',
      path: '/rows/0/content',
      start: 0,
      end: 21,
      text: 'Maple opens at 09:00.',
    },
    usage: [{ totalTokens: 10 }],
  })
  expect(mocks.decide).toHaveBeenCalledOnce()
})
it('preserves field relationships in scalar records and escapes JSON pointer keys', () => {
  const result = collectAnswerPassages([
    { ...observation, value: { 'a/b~c': { height: 12, unit: 'm' } } },
  ])
  expect(result.passages).toMatchObject([
    { path: '/a~1b~0c', text: '{"height":12,"unit":"m"}', format: 'json' },
  ])
})
it('does not quote failed calls, supplied history, or invented model text', async () => {
  expect(
    collectAnswerPassages([{ ...observation, ok: false }]).passages,
  ).toEqual([])
  mocks.decide.mockResolvedValue({
    evidence: { value: 'A made up answer' },
    meta: { usage: {} },
  })
  await expect(selectAnswerEvidence(input)).rejects.toThrow(
    'Unknown answer passage',
  )
})
it('keeps abstention explicit and refuses incomplete evidence enumeration', async () => {
  mocks.decide.mockResolvedValue({
    evidence: { value: 'none' },
    meta: { usage: {} },
  })
  expect(await selectAnswerEvidence(input)).toMatchObject({
    status: 'no-answer',
    passage: null,
  })
  mocks.decide.mockClear()
  expect(
    await selectAnswerEvidence({
      ...input,
      observations: [
        {
          ...observation,
          value: Array.from({ length: 200 }, (_, i) => `Record ${i}`),
        },
      ],
    }),
  ).toMatchObject({ status: 'budget-exhausted', passage: null, usage: [] })
  expect(mocks.decide).not.toHaveBeenCalled()
})
it('does not turn tool-supplied HTML, links or images into active Markdown', () => {
  const passage = collectAnswerPassages([
    {
      ...observation,
      toolName: '[run](javascript:bad)',
      value: '![image](https://example.com/track)\n<script>bad</script>',
    },
  ]).passages[0]
  expect(renderAnswerEvidence(passage)).toContain(
    '\\!\\[image\\]\\(https://example\\.com/track\\)',
  )
  expect(renderAnswerEvidence(passage)).toContain(
    '\\[run\\]\\(javascript:bad\\)',
  )
})
it('rejects duplicate observation identities and handles cyclic results without looping', () => {
  expect(() => collectAnswerPassages([observation, observation])).toThrow(
    'Duplicate',
  )
  const value: { self?: unknown } = {}
  value.self = value
  expect(collectAnswerPassages([{ ...observation, value }]).complete).toBe(
    false,
  )
})
it('honors cancellation before spending a decision call', async () => {
  await expect(
    selectAnswerEvidence({ ...input, signal: AbortSignal.abort() }),
  ).rejects.toThrow()
  expect(mocks.decide).not.toHaveBeenCalled()
})
