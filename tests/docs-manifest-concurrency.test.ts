import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectDocsManifest,
  collectRedirectEntriesForFile,
  isDocsManifest,
  mapWithConcurrency,
  type DocsTreeNode,
} from '../src/utils/docs.functions'
import { GitHubContentError } from '../src/utils/documents.server'

test('mapWithConcurrency preserves result order regardless of completion order', async () => {
  const delays = [30, 5, 20, 1, 15]

  const results = await mapWithConcurrency(delays, 3, async (delay) => {
    await new Promise((resolve) => setTimeout(resolve, delay))
    return delay
  })

  assert.deepEqual(results, delays)
})

test('mapWithConcurrency bounds concurrency instead of running everything in parallel', async () => {
  const items = Array.from({ length: 12 }, (_, index) => index)
  let inFlight = 0
  let maxInFlight = 0

  await mapWithConcurrency(items, 4, async () => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 10))
    inFlight -= 1
  })

  assert.ok(
    maxInFlight <= 4,
    `expected at most 4 concurrent calls, saw ${maxInFlight}`,
  )
  assert.equal(maxInFlight, 4, 'expected concurrency to reach the cap')
})

test('mapWithConcurrency runs in a bounded number of batches, not one call per item', async () => {
  const items = Array.from({ length: 18 }, (_, index) => index)
  const perItemDelayMs = 20
  const concurrency = 6

  const start = Date.now()
  await mapWithConcurrency(items, concurrency, async () => {
    await new Promise((resolve) => setTimeout(resolve, perItemDelayMs))
  })
  const elapsed = Date.now() - start

  const sequentialWorstCase = items.length * perItemDelayMs
  assert.ok(
    elapsed < sequentialWorstCase / 2,
    `expected concurrent execution well under ${sequentialWorstCase}ms, took ${elapsed}ms`,
  )
})

console.log('docs manifest concurrency tests passed')

test('a failed file read rejects without publishing its canonical path', async () => {
  const paths: Array<string> = []
  const error = new GitHubContentError(
    'rate-limit',
    'GitHub rate limited this file',
  )
  await assert.rejects(
    () =>
      collectRedirectEntriesForFile(
        { path: 'docs/guide/a.md' },
        {
          docsRoot: 'docs',
          fetchFile: async () => {
            throw error
          },
          onCanonicalPath: (path) => paths.push(path),
        },
      ),
    (actual) => actual === error,
  )
  assert.deepEqual(paths, [])
})

test('collectRedirectEntriesForFile rethrows non-recoverable errors instead of silently swallowing them', async () => {
  const node: DocsTreeNode = { path: 'docs/guide/old-page.md' }

  await assert.rejects(
    () =>
      collectRedirectEntriesForFile(node, {
        docsRoot: 'docs',
        fetchFile: async () => {
          throw new TypeError('this is a real bug, not a flaky GitHub call')
        },
        onCanonicalPath: () => {},
      }),
    TypeError,
  )
})

test('one failed file rejects the whole manifest instead of returning partial metadata', async () => {
  const nodes = [
    { path: 'docs/a.md' },
    { path: 'docs/flaky.md' },
    { path: 'docs/b.md' },
  ]
  const error = new GitHubContentError('server', 'GitHub 5xx')
  await assert.rejects(
    () =>
      collectDocsManifest(nodes, 'docs', async (path) => {
        if (path === 'docs/flaky.md') throw error
        return '---\nupdated: "2026-09-01"\n---\n# Healthy'
      }),
    (actual) => actual === error,
  )
})

test('missing trees and files fail, while an empty directory remains authoritative', async () => {
  await assert.rejects(
    () => collectDocsManifest(null, 'docs', async () => null),
    /Missing docs tree/,
  )
  assert.deepEqual(await collectDocsManifest([], 'docs', async () => null), {
    paths: [],
    redirects: {},
    lastModifiedByPath: {},
  })
  for (const file of [null, '']) {
    await assert.rejects(
      () =>
        collectDocsManifest(
          [{ path: 'docs/missing.md' }],
          'docs',
          async () => file,
        ),
      /Missing docs file/,
    )
  }
})

test('manifest dates belong to individual canonical pages and preserve undated pages', async () => {
  const dates: Record<string, string> = {}
  const contents: Record<string, string> = {
    'docs/guide/a/index.md': '---\nupdated: "2026-09-01"\n---\n# A',
    'docs/guide/b.md': '---\nupdated: "2026-09-02"\n---\n# B',
    'docs/guide/c.md': '# C',
  }
  const collect = async () => {
    for (const path of Object.keys(contents)) {
      await collectRedirectEntriesForFile(
        { path },
        {
          docsRoot: 'docs',
          fetchFile: async (filePath) => contents[filePath],
          onCanonicalPath: () => {},
          onLastModified: (slug, date) => {
            dates[slug] = date
          },
        },
      )
    }
  }
  await collect()
  assert.deepEqual(dates, { 'guide/a': '2026-09-01', 'guide/b': '2026-09-02' })
  contents['docs/guide/a/index.md'] =
    '---\nupdated: "2026-09-03"\n---\n# A revised'
  await collect()
  assert.deepEqual(dates, { 'guide/a': '2026-09-03', 'guide/b': '2026-09-02' })
})

test('manifest cache accepts older records and rejects invalid date maps', () => {
  const base = { paths: ['guide/a'], redirects: {} }
  assert.equal(isDocsManifest(base), true)
  assert.equal(
    isDocsManifest({
      ...base,
      lastModifiedByPath: { 'guide/a': '2026-09-11' },
    }),
    true,
  )
  for (const lastModifiedByPath of [
    null,
    [],
    '2026-09-11',
    { 'guide/a': '2026-02-30' },
    { 'guide/a': 42 },
  ]) {
    assert.equal(isDocsManifest({ ...base, lastModifiedByPath }), false)
  }
})

test('manifest rejects malformed frontmatter instead of caching incomplete metadata', async () => {
  await assert.rejects(
    collectRedirectEntriesForFile(
      { path: 'docs/invalid.md' },
      {
        docsRoot: 'docs',
        fetchFile: async () => '---\ntitle: [invalid YAML\n---\nBody',
        onCanonicalPath: () => {},
      },
    ),
    /Invalid docs frontmatter: docs\/invalid.md/,
  )
})

test('manifest dates use the served sibling even when the index finishes last', async () => {
  for (const sibling of ['---\nupdated: "2026-09-01"\n---\n# A', '# A']) {
    const contents: Record<string, string> = {
      'docs/guide/a.md': sibling,
      'docs/guide/a/index.md': '---\nupdated: "2026-09-02"\n---\n# Index',
      'docs/guide/b/index.md': '---\nupdated: "2026-09-03"\n---\n# B',
    }
    const manifest = await collectDocsManifest(
      Object.keys(contents).map((path) => ({ path })),
      'docs',
      async (path) => {
        if (path.endsWith('/index.md'))
          await new Promise((resolve) => setTimeout(resolve, 10))
        return contents[path]
      },
    )
    assert.equal(
      manifest.lastModifiedByPath?.['guide/a'],
      sibling === '# A' ? undefined : '2026-09-01',
    )
    assert.equal(manifest.lastModifiedByPath?.['guide/b'], '2026-09-03')
    assert.deepEqual(manifest.paths.sort(), ['guide/a', 'guide/b'])
  }
})
