import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getChartsCatalogAssetHeaders,
  parseChartsCatalogAssetRequest,
} from '../src/utils/charts-catalog-assets'
import {
  getChartsCatalogAssetUrl,
  parseChartsCatalogManifest,
} from '../src/utils/charts-catalog'
import {
  ChartsCatalogIntegrityError,
  ChartsCatalogResourceNotFoundError,
  classifyChartsCatalogAssetError,
  getChartsCatalogManifestAtRevision,
} from '../src/utils/charts-catalog.server'
import { GitHubContentError } from '../src/utils/documents.server'
import {
  listDocsCacheRepoStats,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import {
  artifactRevision,
  createChartsCatalogManifest,
  tanstackAsset,
} from './charts-catalog-test-fixture'

const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())

test('catalog assets resolve only through an immutable artifact revision', () => {
  const request = parseChartsCatalogAssetRequest({
    artifactRevision,
    assetPath: tanstackAsset,
    manifest,
  })

  assert.equal(request.repo, 'tanstack/charts')
  assert.equal(request.repoPath, tanstackAsset)
  assert.equal(
    getChartsCatalogAssetUrl(artifactRevision, tanstackAsset),
    `/charts/catalog/assets/${artifactRevision}/${tanstackAsset}`,
  )
})

for (const artifactRevision of [
  'catalog-dist',
  'main',
  'A'.repeat(40),
  '1'.repeat(39),
  '1'.repeat(41),
]) {
  test(`catalog assets reject mutable or malformed revision ${artifactRevision}`, () => {
    assert.throws(() =>
      parseChartsCatalogAssetRequest({
        artifactRevision,
        assetPath: tanstackAsset,
        manifest,
      }),
    )
  })
}

for (const assetPath of [
  '../catalog.json',
  'assets/../catalog.json',
  'assets/%2e%2e/catalog.json',
  'assets/%2Fcatalog.json',
  'assets/%5ccatalog.json',
  'assets\\catalog.js',
  '/assets/tanstack-AbC_1.js',
  'assets//tanstack-AbC_1.js',
  'assets/not-allowlisted.js',
  'catalog.json',
]) {
  test(`catalog assets reject unsafe or unlisted path ${assetPath}`, () => {
    assert.throws(() =>
      parseChartsCatalogAssetRequest({
        artifactRevision,
        assetPath,
        manifest,
      }),
    )
  })
}

test('catalog JavaScript uses immutable same-origin response headers', () => {
  const headers = new Headers(getChartsCatalogAssetHeaders())

  assert.equal(
    headers.get('Cache-Control'),
    'public, max-age=31536000, immutable',
  )
  assert.equal(
    headers.get('Cloudflare-CDN-Cache-Control'),
    'public, max-age=31536000, immutable',
  )
  assert.match(headers.get('Content-Type') ?? '', /javascript/)
  assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'same-origin')
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(headers.get('Access-Control-Allow-Origin'), null)
})

test('catalog asset failures preserve missing, transient, and integrity semantics', () => {
  assert.equal(
    classifyChartsCatalogAssetError(
      new ChartsCatalogResourceNotFoundError('missing'),
    ),
    'not-found',
  )

  for (const kind of ['network', 'rate-limit', 'server'] as const) {
    assert.equal(
      classifyChartsCatalogAssetError(new GitHubContentError(kind, kind)),
      'unavailable',
    )
  }

  assert.equal(
    classifyChartsCatalogAssetError(
      new ChartsCatalogIntegrityError('digest mismatch'),
    ),
    'internal',
  )
  assert.equal(
    classifyChartsCatalogAssetError(
      new GitHubContentError('invalid-response', 'invalid response'),
    ),
    'internal',
  )
})

test('catalog assets admit recent published revisions without caching random SHAs', async () => {
  resetGitHubContentCacheForTest()

  const originalFetch = globalThis.fetch
  const historicalRevision = '3'.repeat(40)
  const unpublishedRevisions = ['4'.repeat(40), '5'.repeat(40)]
  const requests = new Array<string>()

  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)

    if (
      url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
    ) {
      return Response.json([
        { sha: artifactRevision },
        { sha: historicalRevision },
      ])
    }

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
      return Response.json(createChartsCatalogManifest())
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${historicalRevision}/catalog.json`
    ) {
      return Response.json(createChartsCatalogManifest())
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    for (const unpublishedRevision of unpublishedRevisions) {
      await assert.rejects(
        getChartsCatalogManifestAtRevision(unpublishedRevision),
        ChartsCatalogResourceNotFoundError,
      )
    }
    assert.equal(requests.length, 3)

    const statsAfterRejection = await listDocsCacheRepoStats()
    assert.equal(statsAfterRejection[0]?.contentEntries, 2)
    assert.equal(statsAfterRejection[0]?.cachedRefCount, 2)

    const historicalManifest =
      await getChartsCatalogManifestAtRevision(historicalRevision)
    assert.equal(historicalManifest.revision, '1'.repeat(40))
    assert.equal(requests.length, 4)
    assert.equal(
      requests[3],
      `https://raw.githubusercontent.com/tanstack/charts/${historicalRevision}/catalog.json`,
    )

    const statsAfterHistoricalRead = await listDocsCacheRepoStats()
    assert.equal(statsAfterHistoricalRead[0]?.contentEntries, 3)
    assert.equal(statsAfterHistoricalRead[0]?.cachedRefCount, 3)
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})
