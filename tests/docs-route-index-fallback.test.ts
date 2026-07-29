import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDocsRoute, type LoadDocsRouteFetchers } from '../src/utils/docs'

// Mirrors TanStack/pacer's real docs layout (TanStack/pacer#237): the root
// docs/config.json links "Core API Reference" to `reference/index`, backed by
// `docs/reference/index.md`, and each framework has its own
// `docs/framework/<framework>/reference/index.md`. Neither `docs/reference.md`
// nor `docs/framework/react/reference.md` exists, while the docs path
// manifest canonicalizes index files to their parent path.
const repoFiles: Record<string, string> = {
  'docs/overview.md': 'Overview',
  'docs/reference/index.md': 'Core API Reference',
  'docs/reference/classes/Debouncer.md': 'Debouncer',
  'docs/framework/react/adapter.md': 'React Adapter',
  'docs/framework/react/reference/index.md': 'React API Reference',
}

const manifestPaths = [
  'overview',
  'reference',
  'reference/classes/Debouncer',
  'framework/react/adapter',
  'framework/react/reference',
]

type FetchedDoc = Awaited<ReturnType<LoadDocsRouteFetchers['fetchDocs']>>

function createFetchers() {
  const fetchedFilePaths: Array<string> = []

  const fetchers: LoadDocsRouteFetchers = {
    fetchDocs: async ({ data }) => {
      fetchedFilePaths.push(data.filePath)
      const content = repoFiles[data.filePath]

      if (content === undefined) {
        throw { isNotFound: true }
      }

      const doc: FetchedDoc = {
        content,
        title: content,
        description: '',
        keywords: undefined,
        frameworks: [],
        filePath: data.filePath,
        frontmatter: { description: '' },
      }

      return doc
    },
    fetchDocsPathManifest: async () => ({
      paths: manifestPaths,
      redirects: {},
    }),
    fetchDocsRedirect: async () => null,
  }

  return { fetchers, fetchedFilePaths }
}

function loadRoute(docsPath: string, fetchers: LoadDocsRouteFetchers) {
  return loadDocsRoute(
    {
      repo: 'TanStack/pacer',
      branch: 'main',
      docsRoot: 'docs',
      docsPath,
      defaultDocs: 'overview',
      frameworks: ['react', 'solid'],
      redirectFromPaths: [docsPath],
    },
    fetchers,
  )
}

test('root-level reference/index loads the index file behind its canonical path', async () => {
  const { fetchers } = createFetchers()

  for (const docsPath of ['reference/index', 'reference']) {
    const result = await loadRoute(docsPath, fetchers)

    assert.equal(result.type, 'loaded', `${docsPath} should load`)
    assert.ok(result.type === 'loaded')
    assert.equal(result.docsPath, 'reference')
    assert.equal(result.doc.filePath, 'docs/reference/index.md')
  }
})

test('framework-scoped reference/index loads the index file behind its canonical path', async () => {
  const { fetchers } = createFetchers()

  for (const docsPath of [
    'framework/react/reference/index',
    'framework/react/reference',
  ]) {
    const result = await loadRoute(docsPath, fetchers)

    assert.equal(result.type, 'loaded', `${docsPath} should load`)
    assert.ok(result.type === 'loaded')
    assert.equal(result.docsPath, 'framework/react/reference')
    assert.equal(result.doc.filePath, 'docs/framework/react/reference/index.md')
  }
})

test('plain docs files still load directly without an index fallback fetch', async () => {
  const { fetchers, fetchedFilePaths } = createFetchers()

  const result = await loadRoute('framework/react/adapter', fetchers)

  assert.equal(result.type, 'loaded')
  assert.ok(result.type === 'loaded')
  assert.equal(result.doc.filePath, 'docs/framework/react/adapter.md')
  assert.deepEqual(fetchedFilePaths, ['docs/framework/react/adapter.md'])
})

test('genuinely missing docs paths still resolve to not-found', async () => {
  const { fetchers } = createFetchers()

  const result = await loadRoute('guides/does-not-exist', fetchers)

  assert.deepEqual(result, { type: 'not-found' })
})

test('missing paths under an indexable section keep redirecting to the section index', async () => {
  const { fetchers } = createFetchers()

  const result = await loadRoute('reference/does-not-exist', fetchers)

  assert.deepEqual(result, { type: 'redirect', docsPath: 'reference' })
})

test('a manifest path with no backing file (even as an index) is not-found', async () => {
  const { fetchers } = createFetchers()

  const ghostFetchers: LoadDocsRouteFetchers = {
    ...fetchers,
    fetchDocsPathManifest: async () => ({
      paths: [...manifestPaths, 'guides/ghost'],
      redirects: {},
    }),
  }

  const result = await loadRoute('guides/ghost', ghostFetchers)

  assert.deepEqual(result, { type: 'not-found' })
})

console.log('docs route index fallback tests passed')
