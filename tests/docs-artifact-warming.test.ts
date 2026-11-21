import assert from 'node:assert/strict'
import test from 'node:test'
import { isDocsManifest } from '../src/utils/docs.functions'
import {
  getCachedDocsArtifact,
  markDocsArtifactsStale,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'

test('manifest validation rejects malformed cached payloads', () => {
  assert.equal(
    isDocsManifest({ paths: ['overview'], redirects: { old: 'overview' } }),
    true,
  )
  for (const payload of [
    null,
    { paths: [4], redirects: {} },
    { paths: [], redirects: null },
    { paths: [], redirects: [] },
    { paths: [], redirects: { old: 4 } },
  ]) {
    assert.equal(isDocsManifest(payload), false)
  }
})

test('artifact cache shares cold and invalidated builds and recovers after failure', async () => {
  resetGitHubContentCacheForTest()
  let builds = 0
  let fail = false
  const opts = {
    repo: 'tanstack/router',
    gitRef: 'main',
    docsRoot: 'docs',
    artifactType: 'docs-manifest',
    artifactKey: 'default',
    isValue: isDocsManifest,
    build: async () => {
      builds += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      if (fail) throw new Error('fixture source unavailable')
      return { paths: [`version-${builds}`], redirects: {} }
    },
  }
  const cold = await Promise.all(
    Array.from({ length: 8 }, () => getCachedDocsArtifact(opts)),
  )
  assert.equal(builds, 1)
  assert.ok(cold.every((value) => value.paths[0] === 'version-1'))
  await markDocsArtifactsStale({ repo: opts.repo, gitRef: opts.gitRef })
  const warm = await Promise.all(
    Array.from({ length: 8 }, () => getCachedDocsArtifact(opts)),
  )
  assert.equal(builds, 2)
  assert.ok(warm.every((value) => value.paths[0] === 'version-2'))
  await getCachedDocsArtifact(opts)
  assert.equal(builds, 2)
  resetGitHubContentCacheForTest()
  fail = true
  await assert.rejects(
    getCachedDocsArtifact(opts),
    /fixture source unavailable/,
  )
  fail = false
  assert.deepEqual(await getCachedDocsArtifact(opts), {
    paths: ['version-4'],
    redirects: {},
  })
})
