import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dashboardCacheKey,
  withDashboardCache,
} from '../src/components/dashboard/server/cache'
import { dashboardSearch } from '../src/components/dashboard/model'
import { serverRequestSchema } from '../src/components/dashboard/request'
import type { DashboardResult } from '../src/components/dashboard/server/queries'
import type { BlobStorage } from '../src/server/runtime/blob-storage.server'
const request = serverRequestSchema.parse({
  ...dashboardSearch.parse({}),
  selection: { all: false, ids: [] },
})
const result: DashboardResult = {
  analysis: {
    timeline: [],
    days: [],
    hours: [],
    durations: [],
    zones: [],
    summary: { count: 0, fareCents: 0 },
    medianMinutes: 0,
    averageMiles: 0,
  },
  rows: [],
  rowCount: 0,
  page: 0,
  total: { count: 0, fareCents: 0, median: 0, average: 0 },
  parent: { count: 0, fareCents: 0 },
  selectedTotals: { count: 0, fareCents: 0 },
  boroughFacets: [],
  allZones: [],
  selected: undefined,
  selectedMatches: false,
  snapshotCount: 8936,
}
function storage() {
  const objects = new Map<string, string>()
  const bucket: BlobStorage = {
    get: async (key) => {
      const value = objects.get(key)
      if (value === undefined) return null
      return {
        key,
        etag: 'test',
        body: null,
        text: async () => value,
        arrayBuffer: async () => new TextEncoder().encode(value).buffer,
      }
    },
    put: async (key, value) => {
      assert.equal(typeof value, 'string')
      objects.set(key, String(value))
      return true
    },
    delete: async (keys) => {
      for (const key of typeof keys === 'string' ? [keys] : keys)
        objects.delete(key)
    },
    list: async () => ({ objects: [], truncated: false }),
  }
  return { bucket, objects }
}
test('common requests share a durable cache and do not reopen the database', async () => {
  const { bucket } = storage()
  let reads = 0
  const read = async () => {
    reads++
    return result
  }
  assert.deepEqual(await withDashboardCache(request, bucket, read), result)
  assert.deepEqual(await withDashboardCache(request, bucket, read), result)
  assert.equal(reads, 1)
})
test('unbounded user input and selection never create persistent cache objects', async () => {
  const { bucket, objects } = storage()
  const inputs = [
    { ...request, selected: 32 },
    { ...request, zone: 95 },
    { ...request, borough: 'arbitrary' },
    { ...request, selection: { all: true, ids: [] } },
    { ...request, selection: { all: false, ids: [32] } },
    { ...request, grid: { ...request.grid, query: 'anything' } },
    { ...request, grid: { ...request.grid, page: 3 } },
  ]
  for (const input of inputs) {
    assert.equal(dashboardCacheKey(input), undefined)
    await withDashboardCache(input, bucket, async () => result)
  }
  assert.equal(objects.size, 0)
})
test('cache corruption or unavailability does not turn a working database request into an error', async () => {
  const { bucket, objects } = storage()
  const key = dashboardCacheKey(request)
  assert.ok(key)
  objects.set(key, '{corrupt')
  assert.deepEqual(
    await withDashboardCache(request, bucket, async () => result),
    result,
  )
  assert.deepEqual(
    await withDashboardCache(
      request,
      {
        ...bucket,
        get: async () => {
          throw new Error('R2 down')
        },
        put: async () => {
          throw new Error('R2 down')
        },
      },
      async () => result,
    ),
    result,
  )
})
test('page and scope changes have distinct bounded keys', () => {
  assert.notEqual(
    dashboardCacheKey(request),
    dashboardCacheKey({ ...request, day: 1 }),
  )
  assert.notEqual(
    dashboardCacheKey(request),
    dashboardCacheKey({ ...request, grid: { ...request.grid, page: 1 } }),
  )
})
