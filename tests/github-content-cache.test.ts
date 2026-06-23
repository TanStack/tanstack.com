import assert from 'node:assert/strict'
import {
  getCachedDocsArtifact,
  getCachedGitHubJsonContent,
  getCachedGitHubTextFile,
  markDocsArtifactsStale,
  markGitHubContentStale,
  pruneStaleCacheRows,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'

const repo = 'tanstack/router'
const gitRef = 'main'

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDocsManifest(value: unknown): value is { paths: Array<string> } {
  if (!isObject(value)) {
    return false
  }

  return isStringArray(value.paths)
}

async function testMissStoresContent() {
  resetGitHubContentCacheForTest()

  let originCalls = 0
  const result = await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/guide.md',
    origin: async () => {
      originCalls += 1
      return 'guide'
    },
  })

  assert.equal(result, 'guide')
  assert.equal(originCalls, 1)
}

async function testFreshHitSkipsOrigin() {
  resetGitHubContentCacheForTest()

  let originCalls = 0
  const opts = {
    repo,
    gitRef,
    path: 'docs/fresh.md',
    origin: async () => {
      originCalls += 1
      return 'fresh'
    },
  }

  assert.equal(await getCachedGitHubTextFile(opts), 'fresh')
  assert.equal(await getCachedGitHubTextFile(opts), 'fresh')
  assert.equal(originCalls, 1)
}

async function testForcedStaleRefreshes() {
  resetGitHubContentCacheForTest()

  await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/stale.md',
    origin: async () => 'old',
  })

  assert.equal(await markGitHubContentStale({ repo, gitRef }), 1)

  let originCalls = 0
  const result = await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/stale.md',
    origin: async () => {
      originCalls += 1
      return 'new'
    },
  })

  assert.equal(result, 'new')
  assert.equal(originCalls, 1)
}

async function testNegativeHitSkipsOrigin() {
  resetGitHubContentCacheForTest()

  let originCalls = 0
  const opts = {
    repo,
    gitRef,
    path: 'docs/missing.md',
    origin: async () => {
      originCalls += 1
      return null
    },
  }

  assert.equal(await getCachedGitHubTextFile(opts), null)
  assert.equal(await getCachedGitHubTextFile(opts), null)
  assert.equal(originCalls, 1)
}

async function testRefreshFailureFallsBackToStaleContent() {
  resetGitHubContentCacheForTest()

  await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/outage.md',
    origin: async () => 'cached',
  })

  await markGitHubContentStale({ repo, gitRef })

  const result = await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/outage.md',
    origin: async () => {
      throw new Error('GitHub unavailable')
    },
  })

  assert.equal(result, 'cached')
}

async function testJsonContentUsesTypeGuard() {
  resetGitHubContentCacheForTest()

  let originCalls = 0
  const opts = {
    repo,
    gitRef,
    path: '__github_recursive_tree__',
    isValue: isStringArray,
    origin: async () => {
      originCalls += 1
      return ['docs/index.md']
    },
  }

  assert.deepEqual(await getCachedGitHubJsonContent(opts), ['docs/index.md'])
  assert.deepEqual(await getCachedGitHubJsonContent(opts), ['docs/index.md'])
  assert.equal(originCalls, 1)
}

async function testArtifactInvalidationAndPruneDelete() {
  resetGitHubContentCacheForTest()

  await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/delete.md',
    origin: async () => 'before-delete',
  })

  await getCachedDocsArtifact({
    repo,
    gitRef,
    docsRoot: 'docs',
    artifactType: 'docs-manifest',
    artifactKey: 'default',
    isValue: isDocsManifest,
    build: async () => ({ paths: ['docs/delete.md'] }),
  })

  assert.equal(await markGitHubContentStale({ repo, gitRef }), 1)
  assert.equal(await markDocsArtifactsStale({ repo, gitRef }), 1)

  const prune = await pruneStaleCacheRows({
    maxAgeMs: -1,
    negativeMaxAgeMs: -1,
  })

  assert.equal(prune.githubContentDeleted, 1)
  assert.equal(prune.docsArtifactDeleted, 1)

  let originCalls = 0
  const result = await getCachedGitHubTextFile({
    repo,
    gitRef,
    path: 'docs/delete.md',
    origin: async () => {
      originCalls += 1
      return 'after-delete'
    },
  })

  assert.equal(result, 'after-delete')
  assert.equal(originCalls, 1)
}

await testMissStoresContent()
await testFreshHitSkipsOrigin()
await testForcedStaleRefreshes()
await testNegativeHitSkipsOrigin()
await testRefreshFailureFallsBackToStaleContent()
await testJsonContentUsesTypeGuard()
await testArtifactInvalidationAndPruneDelete()

console.log('github-content-cache tests passed')
