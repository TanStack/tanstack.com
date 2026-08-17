import assert from 'node:assert/strict'
import {
  getExternalBlogPosts,
  inferExternalPostLibraries,
} from '../src/utils/external-blog-posts.server'

assert.deepEqual(
  inferExternalPostLibraries(
    'Concurrent Optimistic Updates in React Query',
    'https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query',
  ),
  ['query'],
)
assert.deepEqual(
  inferExternalPostLibraries(
    'TanStack Router and Query',
    'https://tkdodo.eu/blog/tanstack-router-and-query',
  ),
  ['query', 'router'],
)
assert.deepEqual(
  inferExternalPostLibraries(
    'Working with TypeScript',
    'https://tkdodo.eu/blog/working-with-typescript',
  ),
  [],
)

const originalFetch = globalThis.fetch
const originalWarn = console.warn
let fetchCount = 0

globalThis.fetch = async () => {
  fetchCount++
  throw new Error('External source unavailable')
}
console.warn = () => {}

try {
  assert.deepEqual(await getExternalBlogPosts({ libraryId: 'table' }), [])
  assert.equal(fetchCount, 0, 'unrelated libraries skip external sources')

  assert.deepEqual(await getExternalBlogPosts({ libraryId: 'query' }), [])
  assert.equal(fetchCount, 1, 'supported libraries fetch their external source')

  assert.deepEqual(await getExternalBlogPosts({ libraryId: 'query' }), [])
  assert.equal(fetchCount, 1, 'failed external fetches use the short backoff')
} finally {
  globalThis.fetch = originalFetch
  console.warn = originalWarn
}

console.log('external blog post tests passed')
