import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import {
  getCachedDocsArtifact,
  getCachedGitHubTextFile,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import { createMockR2Bucket } from './github-cache-test-utils'

function createEdgeCache() {
  const entries = new Map<string, Response>()
  return {
    entries,
    async match(request: Request) {
      return entries.get(request.url)?.clone()
    },
    async put(request: Request, response: Response) {
      entries.set(request.url, response.clone())
    },
    async delete(request: Request) {
      return entries.delete(request.url)
    },
  }
}

test('separate edge locations reuse an R2 refresh for content and artifacts', async () => {
  resetGitHubContentCacheForTest()
  const previousCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  const previousRuntime = Object.getOwnPropertyDescriptor(
    globalThis,
    'WebSocketPair',
  )
  const edge = createEdgeCache()
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { default: edge },
  })
  Object.defineProperty(globalThis, 'WebSocketPair', {
    configurable: true,
    value: undefined,
  })
  const mock = createMockR2Bucket()
  let writes = 0
  let builds = 0
  let origins = 0
  let failReads = false
  const bucket = {
    ...mock.bucket,
    async get(key: string) {
      if (failReads) throw new Error('R2 unavailable')
      return mock.bucket.get(key)
    },
    async put(...args: Parameters<typeof mock.bucket.put>) {
      writes += 1
      return mock.bucket.put(...args)
    },
  }
  const content = {
    repo: 'tanstack/router',
    gitRef: 'main',
    path: 'docs/guide.md',
    origin: async () => {
      origins += 1
      return 'fresh content'
    },
  }
  const artifact = {
    repo: content.repo,
    gitRef: content.gitRef,
    docsRoot: 'docs',
    artifactType: 'docs-manifest',
    artifactKey: 'default',
    isValue: (value: unknown): value is string => typeof value === 'string',
    build: async () => {
      builds += 1
      return 'fresh artifact'
    },
  }
  try {
    await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
      await getCachedGitHubTextFile(content)
      await getCachedDocsArtifact(artifact)
      assert.equal(writes, 2)
      // Each location has an expired edge copy, but shares the fresh R2 objects.
      const staleCopies = Array.from(edge.entries, ([key, response]) => {
        const headers = new Headers(response.headers)
        const metadata: Record<string, string> = JSON.parse(
          headers.get('x-blob-storage-metadata') ?? '{}',
        )
        metadata.staleAt = new Date(Date.now() - 1000).toISOString()
        headers.set('x-blob-storage-metadata', JSON.stringify(metadata))
        return { key, headers, response }
      })
      for (let location = 0; location < 20; location += 1) {
        edge.entries.clear()
        for (const copy of staleCopies) {
          edge.entries.set(
            copy.key,
            new Response(await copy.response.clone().text(), {
              headers: copy.headers,
            }),
          )
        }
        assert.equal(await getCachedGitHubTextFile(content), 'fresh content')
        assert.equal(await getCachedDocsArtifact(artifact), 'fresh artifact')
      }
      assert.equal(
        origins,
        1,
        'other locations must check R2 before calling GitHub',
      )
      assert.equal(builds, 1, 'other locations must reuse the shared artifact')
      assert.equal(
        writes,
        2,
        'expired edge copies must not rewrite fresh R2 objects',
      )
      // A genuinely expired R2 record still refreshes on the existing schedule.
      for (const object of mock.objects.values()) {
        if (object.customMetadata)
          object.customMetadata.staleAt = new Date(
            Date.now() - 1000,
          ).toISOString()
      }
      for (const copy of staleCopies) {
        edge.entries.set(
          copy.key,
          new Response(await copy.response.clone().text(), {
            headers: copy.headers,
          }),
        )
      }
      assert.equal(
        await getCachedGitHubTextFile({
          ...content,
          origin: async () => 'updated content',
        }),
        'updated content',
      )
      assert.equal(
        await getCachedDocsArtifact({
          ...artifact,
          build: async () => 'updated artifact',
        }),
        'updated artifact',
      )
      assert.equal(writes, 4)

      // Shared-store and origin outages must retain the edge fallback.
      failReads = true
      for (const copy of staleCopies) {
        edge.entries.set(
          copy.key,
          new Response(await copy.response.clone().text(), {
            headers: copy.headers,
          }),
        )
      }
      assert.equal(
        await getCachedGitHubTextFile({
          ...content,
          origin: async () => {
            throw new Error('GitHub unavailable')
          },
        }),
        'fresh content',
      )
      assert.equal(
        await getCachedDocsArtifact({
          ...artifact,
          build: async () => {
            throw new Error('GitHub unavailable')
          },
        }),
        'fresh artifact',
      )
      assert.equal(writes, 4)
      edge.entries.clear()
      await assert.rejects(getCachedGitHubTextFile(content), /R2 unavailable/)
    })
  } finally {
    if (previousCaches)
      Object.defineProperty(globalThis, 'caches', previousCaches)
    else Reflect.deleteProperty(globalThis, 'caches')
    if (previousRuntime)
      Object.defineProperty(globalThis, 'WebSocketPair', previousRuntime)
    else Reflect.deleteProperty(globalThis, 'WebSocketPair')
    resetGitHubContentCacheForTest()
  }
})
