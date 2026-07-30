import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDocs } from '../src/utils/docs'

type FetchDocs = NonNullable<Parameters<typeof loadDocs>[1]>
type FetchedDoc = Awaited<ReturnType<FetchDocs>>

const repoFiles: Record<string, string> = {
  'docs/overview.md': 'Overview',
  'docs/reference/index.md': 'Core API Reference',
  'docs/framework/react/reference/index.md': 'React API Reference',
}

function createFetchDocs() {
  const fetchedFilePaths: Array<string> = []

  const fetchDocs: FetchDocs = async ({ data }) => {
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
  }

  return { fetchDocs, fetchedFilePaths }
}

function load(docsPath: string, fetchDocs: FetchDocs) {
  return loadDocs(
    {
      repo: 'TanStack/pacer',
      branch: 'main',
      docsRoot: 'docs',
      docsPath,
    },
    fetchDocs,
  )
}

test('canonical reference paths load their index files', async () => {
  for (const [docsPath, expectedFilePath] of [
    ['reference', 'docs/reference/index.md'],
    ['framework/react/reference', 'docs/framework/react/reference/index.md'],
  ]) {
    const { fetchDocs, fetchedFilePaths } = createFetchDocs()
    const doc = await load(docsPath, fetchDocs)

    assert.equal(doc.filePath, expectedFilePath)
    assert.deepEqual(fetchedFilePaths, [
      `docs/${docsPath}.md`,
      expectedFilePath,
    ])
  }
})

test('plain docs files load without an index fallback request', async () => {
  const { fetchDocs, fetchedFilePaths } = createFetchDocs()
  const doc = await load('overview', fetchDocs)

  assert.equal(doc.filePath, 'docs/overview.md')
  assert.deepEqual(fetchedFilePaths, ['docs/overview.md'])
})

test('non-404 index fetch failures propagate', async () => {
  let fetchCount = 0
  const fetchDocs: FetchDocs = async () => {
    fetchCount += 1

    if (fetchCount === 1) {
      throw { isNotFound: true }
    }

    throw new Error('GitHub unavailable')
  }

  await assert.rejects(() => load('reference', fetchDocs), /GitHub unavailable/)
  assert.equal(fetchCount, 2)
})
