import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, hashKey } from '@tanstack/react-query'
import {
  dashboardKey,
  dashboardOptions,
  snapshotOptions,
} from '../src/components/dashboard/query-options'
import { serverRequestSchema } from '../src/components/dashboard/request'
import { dashboardSearch } from '../src/components/dashboard/model'

function requestDefaults() {
  return serverRequestSchema.parse({
    ...dashboardSearch.parse({}),
    selection: { all: false, ids: [] },
  })
}

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
}

test('dashboard keys include every server dependency, but ignore presentation', () => {
  const base = requestDefaults()
  const key = hashKey(dashboardKey(base))
  for (const change of [
    { day: 1 },
    { zone: 10 },
    { borough: 'Queens' },
    { selected: 1 },
    { grid: { ...base.grid, query: 'Forest' } },
    { grid: { ...base.grid, page: 1 } },
    { grid: { ...base.grid, size: 100 } },
    { grid: { ...base.grid, sorting: [{ id: 'miles', desc: true }] } },
    { grid: { ...base.grid, group: 'day' } },
    { grid: { ...base.grid, filters: [{ id: 'zone', value: 'Forest' }] } },
    { selection: { all: true, ids: [] } },
    { selection: { all: false, ids: [1] } },
  ]) {
    assert.notEqual(
      hashKey(dashboardKey(serverRequestSchema.parse({ ...base, ...change }))),
      key,
      JSON.stringify(change),
    )
  }
  assert.equal(
    hashKey(
      dashboardOptions(
        serverRequestSchema.parse({
          ...dashboardSearch.parse({
            kit: 'material',
            appearance: 'dark',
          }),
          selection: { all: false, ids: [] },
        }),
      ).queryKey,
    ),
    key,
  )
  assert.notEqual(hashKey(snapshotOptions.queryKey), key)
})

test('equivalent selection sets share a cache entry without changing input order', () => {
  const input = serverRequestSchema.parse({
    ...requestDefaults(),
    selection: { ids: [9, 2] },
  })
  const other = serverRequestSchema.parse({
    ...requestDefaults(),
    selection: { ids: [2, 9] },
  })
  assert.equal(hashKey(dashboardKey(input)), hashKey(dashboardKey(other)))
  assert.deepEqual(input.selection.ids, [9, 2])
})

test('loader prefetch and consumers share fresh server data; another page fetches separately', async () => {
  const cache = client()
  let requests = 0
  const request = requestDefaults()
  const staleTime = dashboardOptions(request).staleTime
  assert.equal(staleTime, 30_000)
  assert.ok(typeof staleTime === 'number')
  const options = {
    queryKey: dashboardKey(request),
    staleTime,
    queryFn: async () => ++requests,
  }
  try {
    await Promise.all([cache.prefetchQuery(options), cache.fetchQuery(options)])
    assert.equal(await cache.fetchQuery(options), 1)
    assert.equal(requests, 1)
    await cache.fetchQuery({
      ...options,
      queryKey: dashboardKey({
        ...request,
        grid: { ...request.grid, page: 1 },
      }),
    })
    assert.equal(requests, 2)
    await cache.invalidateQueries({ queryKey: options.queryKey, exact: true })
    await cache.fetchQuery(options)
    assert.equal(requests, 3)
  } finally {
    cache.clear()
  }
})

test('background failure preserves the previous successful server result', async () => {
  const cache = client()
  const request = requestDefaults()
  const staleTime = dashboardOptions(request).staleTime
  assert.equal(staleTime, 30_000)
  assert.ok(typeof staleTime === 'number')
  const options = {
    queryKey: dashboardKey(request),
    staleTime,
    queryFn: async () => ({ count: 230 }),
  }
  try {
    await cache.fetchQuery(options)
    await cache.invalidateQueries({ queryKey: options.queryKey, exact: true })
    await assert.rejects(
      cache.fetchQuery({
        ...options,
        queryFn: async () => {
          throw new Error('Connection lost')
        },
      }),
      /Connection lost/,
    )
    assert.deepEqual(cache.getQueryData(options.queryKey), { count: 230 })
    assert.equal(cache.getQueryState(options.queryKey)?.status, 'error')
  } finally {
    cache.clear()
  }
})

test('snapshot fetch consumes Query cancellation and rejects HTTP failures', async (context) => {
  const cache = client()
  let signal: AbortSignal | null | undefined
  const transport = context.mock.method(
    globalThis,
    'fetch',
    async (_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
          once: true,
        })
      })
    },
  )
  try {
    const pending = cache.fetchQuery(snapshotOptions)
    const rejected = assert.rejects(pending)
    await cache.cancelQueries({ queryKey: snapshotOptions.queryKey })
    await rejected
    assert.equal(signal?.aborted, true)
    transport.mock.mockImplementation(
      async () => new Response('', { status: 503 }),
    )
    await assert.rejects(cache.fetchQuery(snapshotOptions), /503/)
  } finally {
    cache.clear()
  }
})
