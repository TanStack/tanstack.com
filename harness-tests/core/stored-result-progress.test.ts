import { expect, it } from 'vitest'
import {
  StoredResults,
  type StoredResultObserver,
} from '../../src/chat/server/stored-results'

it('derives host evidence from the exact stored source, preserving nested resultId data', async () => {
  const values = new Map<string, unknown>()
  const stored = new StoredResults(
    {
      put: async (id, value) => {
        values.set(id, value)
      },
      get: async (id) => values.get(id),
    },
    1,
  )
  const observations: Parameters<StoredResultObserver>[0][] = []
  const observe: StoredResultObserver = async (evidence) => {
    observations.push(evidence)
  }
  const a = (await stored.retain({
    resultId: 'external-authoritative-id',
    text: 'same',
  })) as { resultId: string }
  const b = (await stored.retain({
    text: 'same',
    resultId: 'external-authoritative-id',
  })) as { resultId: string }
  expect(a.resultId).not.toBe(b.resultId)
  await stored.read(a.resultId, '/text', 0, observe)
  await stored.read(b.resultId, '/text', 0, observe)
  expect(observations[0]).toEqual(observations[1])
  await stored.read(a.resultId, '', 0, observe)
  expect(observations[2].result).toMatchObject({
    value: { resultId: 'external-authoritative-id' },
  })
  expect(observations[2].result).not.toHaveProperty('resultId')
  const changed = (await stored.retain({
    resultId: 'different-source-id',
    text: 'same',
  })) as { resultId: string }
  await stored.read(changed.resultId, '/text', 0, observe)
  expect(observations[3].args.sourceDigest).not.toBe(
    observations[0].args.sourceDigest,
  )
  await expect(stored.read('unavailable', '', 0, observe)).rejects.toThrow(
    'unavailable',
  )
  expect(observations).toHaveLength(4)
})
