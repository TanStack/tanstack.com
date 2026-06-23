import assert from 'node:assert/strict'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
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

function createMockR2Bucket() {
  const objects = new Map<
    string,
    {
      customMetadata?: Record<string, string>
      uploaded: Date
      value: string
    }
  >()

  const bucket = {
    async delete(keys: string | Array<string>) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        objects.delete(key)
      }
    },
    async get(key: string) {
      const object = objects.get(key)

      if (!object) {
        return null
      }

      return {
        key,
        customMetadata: object.customMetadata,
        text: async () => object.value,
        uploaded: object.uploaded,
      }
    },
    async list(options?: {
      cursor?: string
      include?: Array<'customMetadata'>
      limit?: number
      prefix?: string
    }) {
      const prefix = options?.prefix ?? ''
      const limit = options?.limit ?? 1000
      const entries = Array.from(objects.entries()).filter(([key]) =>
        key.startsWith(prefix),
      )

      return {
        objects: entries.slice(0, limit).map(([key, object]) => ({
          key,
          customMetadata: object.customMetadata,
          uploaded: object.uploaded,
        })),
        truncated: entries.length > limit,
      }
    },
    async put(
      key: string,
      value: string,
      options?: {
        customMetadata?: Record<string, string>
        httpMetadata?: {
          contentType?: string
        }
      },
    ) {
      objects.set(key, {
        customMetadata: options?.customMetadata,
        uploaded: new Date(),
        value,
      })
    },
  }

  return { bucket, objects }
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

async function testWorkerEnvUsesBlobStorage() {
  resetGitHubContentCacheForTest()

  const mockR2 = createMockR2Bucket()
  let originCalls = 0
  const opts = {
    repo,
    gitRef,
    path: 'docs/blob.md',
    origin: async () => {
      originCalls += 1
      return 'blob'
    },
  }

  const firstResult = await runWithHostRuntimeEnv(
    { GITHUB_CONTENT_CACHE: mockR2.bucket },
    () => getCachedGitHubTextFile(opts),
  )
  const secondResult = await runWithHostRuntimeEnv(
    { GITHUB_CONTENT_CACHE: mockR2.bucket },
    () => getCachedGitHubTextFile(opts),
  )

  assert.equal(firstResult, 'blob')
  assert.equal(secondResult, 'blob')
  assert.equal(originCalls, 1)

  const object = mockR2.objects.get(
    'github:file/tanstack/router/main/docs/blob.md',
  )
  assert.ok(object)
  assert.equal(object.customMetadata?.repo, repo)
  assert.equal(object.customMetadata?.gitRef, gitRef)
  assert.equal(object.customMetadata?.isPresent, 'true')
  assert.deepEqual(JSON.parse(object.value), { value: 'blob' })
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

async function testJsonNegativeEntryRefreshes() {
  resetGitHubContentCacheForTest()

  let originCalls = 0
  const opts = {
    repo,
    gitRef,
    path: 'examples/react/missing',
    isValue: isStringArray,
    origin: async () => {
      originCalls += 1
      return originCalls === 1 ? null : ['examples/react/basic/src/main.tsx']
    },
  }

  assert.equal(await getCachedGitHubJsonContent(opts), null)
  assert.deepEqual(await getCachedGitHubJsonContent(opts), [
    'examples/react/basic/src/main.tsx',
  ])
  assert.equal(originCalls, 2)
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
await testWorkerEnvUsesBlobStorage()
await testForcedStaleRefreshes()
await testNegativeHitSkipsOrigin()
await testJsonNegativeEntryRefreshes()
await testRefreshFailureFallsBackToStaleContent()
await testJsonContentUsesTypeGuard()
await testArtifactInvalidationAndPruneDelete()

console.log('github-content-cache tests passed')
