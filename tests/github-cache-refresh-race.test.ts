import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import {
  getCachedGitHubTextFile,
  getCachedDocsArtifact,
  markDocsArtifactsStale,
  markGitHubContentStale,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import { createMockR2Bucket } from './github-cache-test-utils'

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('not initialized')
  }
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('a refresh started before a push cannot clear that push invalidation', async () => {
  resetGitHubContentCacheForTest()
  const { bucket: underlyingBucket, objects } = createMockR2Bucket()
  let writes = 0
  const bucket = {
    ...underlyingBucket,
    async put(...args: Parameters<typeof underlyingBucket.put>) {
      writes += 1
      return underlyingBucket.put(...args)
    },
  }
  const opts = {
    repo: 'tanstack/router',
    gitRef: 'main',
    path: 'docs/guide.md',
  }
  await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
    await getCachedGitHubTextFile({
      ...opts,
      origin: async () => 'before push',
    })
    for (const object of objects.values()) {
      if (object.customMetadata)
        object.customMetadata.staleAt = new Date(
          Date.now() - 1000,
        ).toISOString()
    }
    const started = deferred<void>()
    const origin = deferred<string>()
    const refresh = getCachedGitHubTextFile({
      ...opts,
      origin: () => {
        started.resolve()
        return origin.promise
      },
    })
    await started.promise
    await markGitHubContentStale(opts)
    const writesAfterInvalidation = writes
    origin.resolve('origin result from before the push')
    await refresh
    assert.equal(writes, writesAfterInvalidation, 'skip a known losing write')
    const stored = objects.get('github:file/tanstack/router/main/docs/guide.md')
    assert.equal(stored?.customMetadata?.staleAt, new Date(0).toISOString())
    assert.equal(JSON.parse(stored?.value ?? '{}').value, 'before push')
    assert.equal(
      await getCachedGitHubTextFile({
        ...opts,
        origin: async () => 'after push',
      }),
      'after push',
    )
  })
  resetGitHubContentCacheForTest()
})

test('invalidation retries if a refresh publishes while it is marking an object stale', async () => {
  resetGitHubContentCacheForTest()
  const mock = createMockR2Bucket()
  const opts = {
    repo: 'tanstack/router',
    gitRef: 'main',
    path: 'docs/guide.md',
  }
  const invalidating = deferred<void>()
  const releaseInvalidation = deferred<void>()
  let blockInvalidation = false
  const bucket = {
    ...mock.bucket,
    async put(...args: Parameters<typeof mock.bucket.put>) {
      if (
        blockInvalidation &&
        args[2]?.customMetadata?.staleAt === new Date(0).toISOString()
      ) {
        blockInvalidation = false
        invalidating.resolve()
        await releaseInvalidation.promise
      }
      return mock.bucket.put(...args)
    },
  }
  await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
    await getCachedGitHubTextFile({ ...opts, origin: async () => 'old' })
    for (const object of mock.objects.values()) {
      if (object.customMetadata)
        object.customMetadata.staleAt = new Date(
          Date.now() - 1000,
        ).toISOString()
    }
    blockInvalidation = true
    const invalidation = markGitHubContentStale(opts)
    await invalidating.promise
    await getCachedGitHubTextFile({ ...opts, origin: async () => 'refreshed' })
    releaseInvalidation.resolve()
    assert.equal(await invalidation, 1)
    const object = mock.objects.get(
      'github:file/tanstack/router/main/docs/guide.md',
    )
    assert.equal(object?.customMetadata?.staleAt, new Date(0).toISOString())
    assert.equal(JSON.parse(object?.value ?? '{}').value, 'refreshed')
  })
  resetGitHubContentCacheForTest()
})

test('an artifact rebuild started before a push cannot publish over invalidation', async () => {
  resetGitHubContentCacheForTest()
  const { bucket: underlyingBucket, objects } = createMockR2Bucket()
  let writes = 0
  const bucket = {
    ...underlyingBucket,
    async put(...args: Parameters<typeof underlyingBucket.put>) {
      writes += 1
      return underlyingBucket.put(...args)
    },
  }
  const opts = {
    repo: 'tanstack/router',
    gitRef: 'main',
    docsRoot: 'docs',
    artifactType: 'docs-manifest',
    artifactKey: 'race',
    isValue: (value: unknown): value is string => typeof value === 'string',
  }
  await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
    await getCachedDocsArtifact({ ...opts, build: async () => 'before push' })
    for (const object of objects.values()) {
      if (object.customMetadata)
        object.customMetadata.staleAt = new Date(
          Date.now() - 1000,
        ).toISOString()
    }
    const started = deferred<void>()
    const build = deferred<string>()
    const refresh = getCachedDocsArtifact({
      ...opts,
      build: () => {
        started.resolve()
        return build.promise
      },
    })
    await started.promise
    await markDocsArtifactsStale(opts)
    const writesAfterInvalidation = writes
    build.resolve('old build')
    await refresh
    assert.equal(writes, writesAfterInvalidation, 'skip a known losing write')
    const stored = objects.get(
      'docs-artifact/tanstack/router/main/docs/docs-manifest/race',
    )
    assert.equal(stored?.customMetadata?.staleAt, new Date(0).toISOString())
    assert.equal(JSON.parse(stored?.value ?? '{}').value, 'before push')
    assert.equal(
      await getCachedDocsArtifact({ ...opts, build: async () => 'after push' }),
      'after push',
    )
  })
  resetGitHubContentCacheForTest()
})

test('conditional publication still protects an invalidation after the final read', async () => {
  resetGitHubContentCacheForTest()
  const mock = createMockR2Bucket()
  const publishing = deferred<void>()
  const releasePublication = deferred<void>()
  let blockPublication = false
  const bucket = {
    ...mock.bucket,
    async put(...args: Parameters<typeof mock.bucket.put>) {
      if (blockPublication) {
        blockPublication = false
        publishing.resolve()
        await releasePublication.promise
      }
      return mock.bucket.put(...args)
    },
  }
  const opts = {
    repo: 'tanstack/router',
    gitRef: 'main',
    path: 'docs/final-read-race.md',
  }
  await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
    await getCachedGitHubTextFile({
      ...opts,
      origin: async () => 'before push',
    })
    for (const object of mock.objects.values()) {
      if (object.customMetadata)
        object.customMetadata.staleAt = new Date(
          Date.now() - 1000,
        ).toISOString()
    }
    blockPublication = true
    const refresh = getCachedGitHubTextFile({
      ...opts,
      origin: async () => 'old origin result',
    })
    await publishing.promise
    await markGitHubContentStale(opts)
    releasePublication.resolve()
    await refresh
    const stored = mock.objects.get(
      'github:file/tanstack/router/main/docs/final-read-race.md',
    )
    assert.equal(stored?.customMetadata?.staleAt, new Date(0).toISOString())
    assert.equal(JSON.parse(stored?.value ?? '{}').value, 'before push')
    assert.equal(
      await getCachedGitHubTextFile({
        ...opts,
        origin: async () => 'after push',
      }),
      'after push',
    )
  })
  resetGitHubContentCacheForTest()
})
