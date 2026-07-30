import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chartsCatalogPublicationCacheHeaders,
  chartsCatalogPublicationCacheTag,
  getChartsCatalogSitemapEntries,
  parseChartsCatalogManifest,
} from '../src/utils/charts-catalog'
import {
  docsWebhookSources,
  isWatchedDocsWebhookSource,
  type DocsWebhookSource,
} from '../src/utils/docs-webhook-sources'
import { createChartsCatalogManifest } from './charts-catalog-test-fixture'

test('sitemap exposes catalog discovery routes but not executable resources', () => {
  const manifest = parseChartsCatalogManifest(createChartsCatalogManifest())
  const entries = getChartsCatalogSitemapEntries(manifest)
  const paths = entries.map((entry) => entry.path)

  assert.deepEqual(paths, [
    '/charts/catalog/',
    '/charts/catalog/all/',
    '/charts/catalog/charts/01-line/',
  ])
  assert.equal(
    paths.some((path) => path.includes('/embed/')),
    false,
  )
  assert.equal(
    paths.some((path) => path.includes('/assets/')),
    false,
  )
  assert.equal(
    paths.some((path) => path.includes('?compare=1')),
    false,
  )
})

test('catalog publication pushes invalidate the GitHub content pipeline', () => {
  assert.equal(
    chartsCatalogPublicationCacheTag,
    'charts-catalog:tanstack/charts:catalog-dist',
  )
  assert.equal(
    isWatchedDocsWebhookSource('tanstack/charts', 'catalog-dist'),
    true,
  )
  assert.equal(
    isWatchedDocsWebhookSource('tanstack/charts', 'catalog-dist-other'),
    false,
  )

  const chartsSource = (docsWebhookSources as Array<DocsWebhookSource>).find(
    (source) => source.repo === 'tanstack/charts',
  )
  assert.ok(chartsSource)
  assert.ok(chartsSource.refs.includes('catalog-dist'))
})

test('catalog publication responses share one cache contract', () => {
  assert.deepEqual(chartsCatalogPublicationCacheHeaders, {
    'Cache-Control': 'public, max-age=60, must-revalidate',
    'Cloudflare-CDN-Cache-Control':
      'public, max-age=300, stale-while-revalidate=300',
    'Cache-Tag': chartsCatalogPublicationCacheTag,
  })
})
