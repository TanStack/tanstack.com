import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDocsFreshness } from '../src/utils/docs-freshness'

test('freshness uses authored metadata and ignores rebuild timestamps', () => {
  assert.deepEqual(
    readDocsFreshness({ updated: '2026-09-11', cachedAt: Date.now() }),
    { updated: '2026-09-11', packages: [] },
  )
  assert.deepEqual(
    readDocsFreshness({ cachedAt: Date.now(), lastFetched: '2026-09-11' }),
    { updated: undefined, packages: [] },
  )
})

test('invalid calendar dates and timestamp-shaped dates are omitted', () => {
  for (const updated of [
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    'yesterday',
    '2026-09-11T00:00:00Z',
    20260911,
  ]) {
    assert.equal(readDocsFreshness({ updated }).updated, undefined)
  }
  assert.equal(
    readDocsFreshness({ updated: '2024-02-29' }).updated,
    '2024-02-29',
  )
})

test('tested packages require exact versions, not moving ranges or tags', () => {
  assert.deepEqual(
    readDocsFreshness({
      testedWith: {
        '@tanstack/react-start': '1.168.52',
        react: '19.2.3',
        vite: '^8.0.14',
        nitro: 'latest',
        bad: 3,
      },
    }).packages,
    [
      { name: '@tanstack/react-start', version: '1.168.52' },
      { name: 'react', version: '19.2.3' },
    ],
  )
  assert.deepEqual(readDocsFreshness({ testedWith: ['react'] }).packages, [])
})
