import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getChartsCatalogManifestAtRevision,
  getChartsCatalogPublication,
} from '../src/utils/charts-catalog.server'
import {
  markDocsArtifactsStale,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import {
  artifactRevision,
  createChartsCatalogManifestV5,
} from './charts-catalog-test-fixture'

test('catalog publication keeps serving the last compatible manifest', async () => {
  resetGitHubContentCacheForTest()
  const originalFetch = globalThis.fetch
  const incompatibleRevision = '3'.repeat(40)
  let currentArtifactRevision = artifactRevision

  globalThis.fetch = async (input) => {
    const url = String(input)

    if (
      url ===
      'https://api.github.com/repos/tanstack/charts/git/ref/heads/catalog-dist'
    ) {
      return Response.json({ object: { sha: currentArtifactRevision } })
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
    ) {
      return Response.json(createChartsCatalogManifestV5())
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${incompatibleRevision}/catalog.json`
    ) {
      return Response.json({ schemaVersion: 2 })
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const compatible = await getChartsCatalogPublication()
    assert.equal(compatible.artifactRevision, artifactRevision)

    assert.equal(
      await markDocsArtifactsStale({
        repo: 'tanstack/charts',
        gitRef: 'catalog-dist',
      }),
      1,
    )
    currentArtifactRevision = incompatibleRevision

    const stale = await getChartsCatalogPublication()
    assert.deepEqual(stale, compatible)
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('current catalog assets use the compatible publication without stale history', async () => {
  resetGitHubContentCacheForTest()
  const originalFetch = globalThis.fetch
  const requests = new Array<string>()

  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)

    if (
      url ===
      'https://api.github.com/repos/tanstack/charts/git/ref/heads/catalog-dist'
    ) {
      return Response.json({ object: { sha: artifactRevision } })
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
    ) {
      return Response.json(createChartsCatalogManifestV5())
    }

    if (
      url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
    ) {
      return Response.json([{ sha: '3'.repeat(40) }])
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const manifest = await getChartsCatalogManifestAtRevision(artifactRevision)
    assert.equal(manifest.revision, '1'.repeat(40))
    assert.equal(
      requests.some((url) => url.includes('/commits?')),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})
