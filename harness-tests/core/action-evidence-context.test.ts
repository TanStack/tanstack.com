import { expect, it } from 'vitest'
import { convertMessagesToModelMessages, type ModelMessage } from '@tanstack/ai'
import { projectAssistantContext } from '../../src/chat/server/assistant-context'

function memory() {
  const values = new Map<string, unknown>()
  return {
    values,
    put: async (id: string, value: unknown) => {
      values.set(id, value)
    },
    get: async (id: string) => values.get(id),
  }
}
const evidence = (content: string): ModelMessage => ({
  role: 'user',
  content,
  metadata: { gumActionEvidence: true },
})

it('retains the host evidence marker through TanStack AI message conversion', () => {
  const converted = convertMessagesToModelMessages([
    {
      id: 'action-evidence:copy',
      role: 'user',
      metadata: { gumActionEvidence: true },
      parts: [{ type: 'text', content: 'Confirmed earlier write.' }],
    },
  ])
  expect(converted).toHaveLength(1)
  expect(converted[0].metadata?.gumActionEvidence).toBe(true)
  expect(converted[0].toolCalls).toBeUndefined()
})

it('keeps all earlier action evidence when ordinary history is compacted', async () => {
  const store = memory()
  const records = [
    evidence('Write A succeeded.'),
    evidence('Write B outcome unknown.'),
  ]
  const history: ModelMessage[] = Array.from({ length: 25 }, (_, index) => [
    { role: 'user' as const, content: `Request ${index}` },
    { role: 'assistant' as const, content: 'Earlier response '.repeat(300) },
  ]).flat()
  const latest: ModelMessage = {
    role: 'user',
    content: 'Summarize the results.',
  }
  const result = await projectAssistantContext(
    [...records, ...history, latest],
    store,
    18000,
  )
  expect(result).toContainEqual(records[0])
  expect(result).toContainEqual(records[1])
  expect(result.at(-1)).toEqual(latest)
  expect(result.length).toBeLessThan(history.length)
  expect(
    result.filter((message) => message.metadata?.gumActionEvidence),
  ).toHaveLength(2)
  expect([...store.values.values()].flat()).not.toContainEqual(records[0])
  expect([...store.values.values()].flat()).not.toContainEqual(records[1])
})

it('retains a read-before-write reference to oversized evidence across repeated passes', async () => {
  const store = memory()
  const record = evidence(
    'Large original result '.repeat(2000) + 'Write outcome: unknown.',
  )
  const first = await projectAssistantContext(
    [record, { role: 'user', content: 'Check that earlier result.' }],
    store,
  )
  const preserved = first.find(
    (message) => message.metadata?.gumActionEvidence,
  )!
  const reference = JSON.parse(preserved.content as string)
  expect(reference.notice).toContain('before proposing or repeating a write')
  expect(reference.notice).toContain('verify unknown outcomes')
  expect(await store.get(reference.archivedMessage)).toEqual(record)
  const pressure: ModelMessage[] = Array.from({ length: 20 }, (_, index) => ({
    role: 'user',
    content: `Later ${index}: ` + 'text '.repeat(1500),
  }))
  const second = await projectAssistantContext(
    [...first, ...pressure],
    store,
    18000,
  )
  expect(second).toContainEqual(preserved)
  expect(await store.get(reference.archivedMessage)).toEqual(record)
  expect(second.flatMap((message) => message.toolCalls ?? [])).toEqual([])
})

it('fails instead of discarding action evidence when the evidence itself exceeds the model budget', async () => {
  const records = Array.from({ length: 8 }, (_, index) =>
    evidence(`Write ${index} ` + 'outcome '.repeat(900)),
  )
  await expect(
    projectAssistantContext(
      [...records, { role: 'user', content: 'Do the next step.' }],
      memory(),
      18000,
    ),
  ).rejects.toThrow('context budget')
})
