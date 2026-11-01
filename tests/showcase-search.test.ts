import assert from 'node:assert/strict'
import test from 'node:test'
import * as v from 'valibot'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  stripSearchParams,
} from '@tanstack/react-router'
import {
  showcaseSearchSchema,
  defaultShowcaseSearch,
} from '../src/utils/showcase-search'

test('showcase defaults stay available to loaders without entering the URL', async () => {
  const root = createRootRoute()
  const showcase = createRoute({
    getParentRoute: () => root,
    path: '/showcase',
    validateSearch: showcaseSearchSchema,
    search: { middlewares: [stripSearchParams(defaultShowcaseSearch)] },
  })
  const router = createRouter({
    routeTree: root.addChildren([showcase]),
    history: createMemoryHistory({ initialEntries: ['/showcase'] }),
  })
  await router.load()
  assert.deepEqual(v.parse(showcaseSearchSchema, {}), { page: 1, pageSize: 24 })
  assert.equal(
    router.buildLocation({ to: '/showcase', search: { page: 1, pageSize: 24 } })
      .href,
    '/showcase',
  )
  const filtered = {
    page: 2,
    pageSize: 48,
    libraryIds: ['query'],
    hasSourceCode: true,
    q: 'dashboard',
  }
  assert.deepEqual(
    router.buildLocation({ to: '/showcase', search: filtered }).search,
    filtered,
  )
})
