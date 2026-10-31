import assert from 'node:assert/strict'
import test from 'node:test'
import { getChartsCatalogSitemapEntries } from '../src/utils/charts-catalog'
import {
  chartsCatalogIndexCacheHeaders,
  chartsCatalogIndexCacheTag,
  parseChartsCatalogIndex,
} from '../src/utils/charts-catalog-index'
import {
  docsWebhookSources,
  isWatchedDocsWebhookSource,
  type DocsWebhookSource,
} from '../src/utils/docs-webhook-sources'

test('sitemap exposes catalog pages but not runtime resources', () => {
  const index = parseChartsCatalogIndex({
    schemaVersion: 2,
    source: {
      repo: 'tanstack/charts',
      pathRoot: 'benchmarks/conformance/',
    },
    cases: [
      {
        schemaVersion: 1,
        order: 1,
        id: '01-line',
        collection: 'shadcn',
        title: 'Line chart',
        family: 'trend',
        intent: 'Show a line.',
        support: 'native',
        features: ['line'],
        source: {
          title: 'Source',
          url: 'https://example.com/source',
        },
        ai: {
          create: 'Create a line chart.',
          maintain: 'Keep the line visible.',
        },
        entries: {
          example: 'benchmarks/conformance/cases/01-line/example.tsx',
        },
      },
    ],
  })

  assert.deepEqual(getChartsCatalogSitemapEntries(index), [
    { path: '/charts/catalog/' },
    { path: '/charts/catalog/collections/shadcn/' },
    { path: '/charts/catalog/charts/01-line/' },
  ])
})

test('Charts main pushes invalidate the catalog index pipeline', () => {
  assert.equal(chartsCatalogIndexCacheTag, 'docs:charts:branch:main')
  assert.equal(isWatchedDocsWebhookSource('tanstack/charts', 'main'), true)
  assert.equal(
    isWatchedDocsWebhookSource('tanstack/charts', 'catalog-dist'),
    false,
  )

  const chartsSource = (docsWebhookSources as Array<DocsWebhookSource>).find(
    (source) => source.repo === 'tanstack/charts',
  )
  assert.ok(chartsSource)
  assert.ok(chartsSource.refs.includes('main'))
  assert.equal(chartsSource.refs.includes('catalog-dist'), false)
})

test('catalog index responses use the Charts main cache contract', () => {
  assert.deepEqual(chartsCatalogIndexCacheHeaders, {
    'Cache-Control': 'public, max-age=60, must-revalidate',
    'Cloudflare-CDN-Cache-Control':
      'public, max-age=300, stale-while-revalidate=300',
    'Cache-Tag': chartsCatalogIndexCacheTag,
  })
})
