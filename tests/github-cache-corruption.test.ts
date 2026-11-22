import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import {
  getCachedDocsArtifact,
  getCachedGitHubTextFile,
  markGitHubContentStale,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import { createMockR2Bucket } from './github-cache-test-utils'

test('conditional refreshes repair existing objects with invalid content or metadata', async () => {
  resetGitHubContentCacheForTest()
  const { bucket, objects } = createMockR2Bucket()
  const contentKey = 'github:file/tanstack/router/main/docs/guide.md'
  const artifactKey =
    'docs-artifact/tanstack/router/main/docs/docs-manifest/default'
  objects.set(contentKey, {
    value: '{broken',
    uploaded: new Date(),
    customMetadata: {
      repo: 'tanstack/router',
      gitRef: 'main',
      path: 'docs/guide.md',
      contentKind: 'file',
      isPresent: 'true',
      staleAt: new Date(Date.now() + 300000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  objects.set(artifactKey, {
    value: JSON.stringify({ value: 'unreadable metadata' }),
    uploaded: new Date(),
    customMetadata: {},
  })
  await runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: bucket }, async () => {
    assert.equal(
      await markGitHubContentStale({ repo: 'tanstack/router', gitRef: 'main' }),
      0,
    )
    assert.equal(
      await getCachedGitHubTextFile({
        repo: 'tanstack/router',
        gitRef: 'main',
        path: 'docs/guide.md',
        origin: async () => 'repaired content',
      }),
      'repaired content',
    )
    assert.equal(
      await getCachedDocsArtifact({
        repo: 'tanstack/router',
        gitRef: 'main',
        docsRoot: 'docs',
        artifactType: 'docs-manifest',
        artifactKey: 'default',
        isValue: (value: unknown): value is string => typeof value === 'string',
        build: async () => 'repaired artifact',
      }),
      'repaired artifact',
    )
  })
  assert.equal(
    JSON.parse(objects.get(contentKey)?.value ?? '{}').value,
    'repaired content',
  )
  assert.equal(
    JSON.parse(objects.get(artifactKey)?.value ?? '{}').value,
    'repaired artifact',
  )
  resetGitHubContentCacheForTest()
})
