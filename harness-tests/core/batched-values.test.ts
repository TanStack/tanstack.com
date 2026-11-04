import { expect, it } from 'vitest'
import { chooseBatchedValue } from '../../src/chat/server/batched-values'
const values = Array.from({ length: 9 }, (_, i) => ({
  id: String(i),
  value: i,
  source: { kind: 'observation' as const, id: 'lookup', path: '/' + i },
}))
const signal = new AbortController().signal

it('compares survivors across multiple rounds rather than comparing batch probabilities', async () => {
  const seen: string[][] = []
  const result = await chooseBatchedValue({
    state: {},
    values,
    signal,
    maxCandidates: 2,
    choose: async (batch) => {
      seen.push(batch.map((v) => v.id))
      return { id: batch.at(-1)!.id, probability: 0.1 }
    },
  })
  expect(result.selected?.value).toBe(8)
  expect(result.rounds).toBe(4)
  expect(new Set(seen.slice(0, 5).flat()).size).toBe(9)
})

it('can reject every finalist even when each earlier batch produced a candidate', async () => {
  let calls = 0
  const result = await chooseBatchedValue({
    state: {},
    values: values.slice(0, 4),
    signal,
    maxCandidates: 2,
    choose: async (batch) => ({
      id: ++calls <= 2 ? batch[0]!.id : 'unresolved',
      probability: 0.5,
    }),
  })
  expect(result.selected).toBeNull()
  expect(result.calls).toBe(3)
})

it('stops before exceeding the shared call budget', async () => {
  let calls = 0
  await expect(
    chooseBatchedValue({
      state: {},
      values,
      signal,
      maxCandidates: 2,
      maxCalls: 5,
      choose: async (batch) => {
        calls++
        return { id: batch[0]!.id, probability: 1 }
      },
    }),
  ).rejects.toThrow('call budget')
  expect(calls).toBe(5)
})

it('does not truncate oversized evidence or values', async () => {
  const choose = async () => {
    throw new Error('must not call')
  }
  await expect(
    chooseBatchedValue({
      state: 'x'.repeat(5000),
      values,
      signal,
      maxBytes: 3000,
      choose,
    }),
  ).rejects.toThrow('evidence alone')
  await expect(
    chooseBatchedValue({
      state: {},
      values: [{ ...values[0]!, value: 'x'.repeat(5000) }],
      signal,
      maxBytes: 3000,
      choose,
    }),
  ).rejects.toThrow('One argument value')
})

it('rejects selections outside the current batch', async () => {
  await expect(
    chooseBatchedValue({
      state: {},
      values,
      signal,
      maxCandidates: 2,
      choose: async () => ({ id: '8', probability: 1 }),
    }),
  ).rejects.toThrow('outside the supplied batch')
})

it('does not continue after cancellation', async () => {
  const controller = new AbortController()
  let calls = 0
  await expect(
    chooseBatchedValue({
      state: {},
      values,
      signal: controller.signal,
      maxCandidates: 2,
      choose: async (batch) => {
        calls++
        controller.abort()
        return { id: batch[0]!.id, probability: 1 }
      },
    }),
  ).rejects.toThrow()
  expect(calls).toBe(1)
})
