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
} from '../src/utils/charts-catalog.server'
import { GitHubContentError } from '../src/utils/documents.server'
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
