import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { ChartsCatalogPreview } from '../src/components/charts/ChartsCatalogPreview'
import { ChartsCatalogDetailPending } from '../src/components/charts/ChartsCatalogPages'
import {
  CatalogChartsHero,
  ChartsCatalogGallery,
} from '../src/components/landing/ChartsCatalogGallery'
import { serveChartsCatalogPreview } from '../src/routes/charts.catalog_.previews.$revision.{$caseId}[.]svg'
import {
  getChartsCatalogPreviewHeaders,
  getChartsCatalogPreviewPath,
  getChartsCatalogPreviewUrl,
  parseChartsCatalogPreviewRequest,
} from '../src/utils/charts-catalog-preview'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'

const revision = 'a'.repeat(40)
const previewSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 192"><path d="M0 192L288 0" stroke="#2563eb"/></svg>'

test('catalog detail navigation exposes feedback while its source loads', () => {
  const routeSource = readFileSync(
    'src/routes/_library/charts.catalog.charts.$caseId.tsx',
    'utf8',
  )
  const html = renderToStaticMarkup(createElement(ChartsCatalogDetailPending))
  const $ = load(html)

  assert.match(routeSource, /pendingComponent: ChartsCatalogDetailPending/)
  assert.match(routeSource, /pendingMs: 250/)
  assert.equal($('[role="status"]').text(), 'Loading chart example…')
})

test('catalog previews map case IDs to immutable source assets', () => {
  assert.equal(
    getChartsCatalogPreviewPath('01-line-gaps'),
    'benchmarks/conformance/previews/01-line-gaps.svg',
  )
  assert.equal(
    getChartsCatalogPreviewUrl(revision, '01-line-gaps'),
    `/charts/catalog/previews/${revision}/01-line-gaps.svg`,
  )
  assert.deepEqual(
    parseChartsCatalogPreviewRequest({
      caseId: '01-line-gaps',
      revision,
    }),
    {
      caseId: '01-line-gaps',
      repoPath: 'benchmarks/conformance/previews/01-line-gaps.svg',
      revision,
    },
  )
})

for (const invalidRevision of [
  'main',
  'current',
  'A'.repeat(40),
  'a'.repeat(39),
  'a'.repeat(41),
]) {
  test(`catalog preview requests reject revision ${invalidRevision}`, () => {
    assert.throws(() =>
      parseChartsCatalogPreviewRequest({
        caseId: '01-line-gaps',
        revision: invalidRevision,
      }),
    )
  })
}

for (const invalidCaseId of [
  '../01-line-gaps',
  '01-line-gaps.svg',
  '01_line_gaps',
  '01-LINE-GAPS',
  '01%2fline-gaps',
  '01\\line-gaps',
]) {
  test(`catalog preview requests reject case ID ${invalidCaseId}`, () => {
    assert.throws(() =>
      parseChartsCatalogPreviewRequest({
        caseId: invalidCaseId,
        revision,
      }),
    )
  })
}

test('catalog preview responses are immutable, sandboxed SVGs', () => {
  const headers = new Headers(getChartsCatalogPreviewHeaders())

  assert.equal(
    headers.get('Cache-Control'),
    'public, max-age=31536000, immutable',
  )
  assert.equal(
    headers.get('Cloudflare-CDN-Cache-Control'),
    'public, max-age=31536000, immutable',
  )
  assert.equal(headers.get('Content-Type'), 'image/svg+xml; charset=utf-8')
  assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'same-origin')
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(
    headers.get('Content-Security-Policy'),
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  )
})

test('catalog preview route reads the source asset at the exact revision', async () => {
  resetGitHubContentCacheForTest()
  const originalFetch = globalThis.fetch
  const requests = new Array<string>()
  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    return url ===
      `https://raw.githubusercontent.com/tanstack/charts/${revision}/benchmarks/conformance/previews/01-line-gaps.svg`
      ? new Response(previewSvg)
      : new Response('Not found', { status: 404 })
  }

  try {
    const response = await requestPreview({
      caseId: '01-line-gaps',
      revision,
    })

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('Content-Type'),
      'image/svg+xml; charset=utf-8',
    )
    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable',
    )
    assert.equal(await response.text(), previewSvg)
    assert.deepEqual(requests, [
      `https://raw.githubusercontent.com/tanstack/charts/${revision}/benchmarks/conformance/previews/01-line-gaps.svg`,
    ])
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog preview route rejects unsafe params without fetching source', async () => {
  const originalFetch = globalThis.fetch
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    return new Response('Not found', { status: 404 })
  }

  try {
    for (const params of [
      { caseId: '../01-line-gaps', revision },
      { caseId: '01-line-gaps', revision: 'main' },
      { caseId: '01-line-gaps', revision: 'A'.repeat(40) },
    ]) {
      const response = await requestPreview(params)
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
    }
    assert.equal(fetchCount, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('current preview alias redirects to the revision-pinned asset', async () => {
  resetGitHubContentCacheForTest()
  const originalFetch = globalThis.fetch
  const requests = new Array<string>()
  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)

    if (
      url === 'https://api.github.com/repos/tanstack/charts/git/ref/heads/main'
    ) {
      return Response.json({ object: { sha: revision } })
    }
    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${revision}/benchmarks/conformance/catalog-index.json`
    ) {
      return Response.json(createCatalogIndex())
    }
    return new Response('Not found', { status: 404 })
  }

  try {
    const response = await requestPreview({
      caseId: '01-line-gaps',
      revision: 'current',
    })

    assert.equal(response.status, 307)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(
      response.headers.get('Location'),
      `/charts/catalog/previews/${revision}/01-line-gaps.svg`,
    )
    assert.equal(
      requests.some((url) => url.includes('/previews/01-line-gaps.svg')),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog previews render the source asset without site geometry or palette', () => {
  const html = renderToStaticMarkup(
    createElement(ChartsCatalogPreview, {
      caseId: '01-line-gaps',
      revision,
    }),
  )
  const $ = load(html)
  const preview = $('img[data-catalog-preview-case="01-line-gaps"]')

  assert.equal(preview.length, 1)
  assert.equal(
    preview.attr('src'),
    `/charts/catalog/previews/${revision}/01-line-gaps.svg`,
  )
  assert.equal(preview.attr('loading'), 'lazy')
  assert.equal(preview.attr('decoding'), 'async')
  assert.equal($('svg').length, 0)

  const previewSource = readFileSync(
    'src/components/charts/ChartsCatalogPreview.tsx',
    'utf8',
  )
  const appStyles = readFileSync('src/styles/app.css', 'utf8')

  assert.doesNotMatch(previewSource, /<svg\b/)
  assert.doesNotMatch(previewSource, /catalog-preview-(?:1|2|3|muted)/)
  assert.doesNotMatch(appStyles, /--catalog-preview-/)
  assert.equal(
    existsSync('src/components/charts/ChartsCatalogPreviewCasesEarly.tsx'),
    false,
  )
  assert.equal(
    existsSync('src/components/charts/ChartsCatalogPreviewCasesLate.tsx'),
    false,
  )
})

test('landing and catalog cards use the landing publication revision', () => {
  const catalog = {
    revision,
    cases: [
      {
        id: '03-temperature-range-band',
        family: 'range',
        order: 1,
        title: 'Temperature Range Band',
      },
      {
        id: 'bar-grouped',
        family: 'bar',
        order: 2,
        title: 'Grouped Bars',
      },
      {
        id: 'scatter-bubble',
        family: 'relationship',
        order: 3,
        title: 'Bubble Scatter',
      },
    ],
  }
  const rootRoute = createRootRoute()
  const chartRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/charts/catalog/charts/$caseId',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/charts/latest'] }),
    routeTree: rootRoute.addChildren([chartRoute]),
  })
  const html = renderToStaticMarkup(
    RouterContextProvider<typeof router>({
      router,
      children: createElement('div', null, [
        createElement(CatalogChartsHero, { catalog, key: 'hero' }),
        createElement(ChartsCatalogGallery, {
          catalog,
          key: 'gallery',
          orderSeed: 'source-preview-contract',
        }),
      ]),
    }),
  )
  const $ = load(html)
  const previews = $('img[data-catalog-preview-case]')

  assert.ok(previews.length > 0)
  previews.each((_, element) => {
    const caseId = $(element).attr('data-catalog-preview-case')
    assert.equal(
      $(element).attr('src'),
      `/charts/catalog/previews/${revision}/${caseId}.svg`,
    )
  })
  assert.equal($('img[src*="/current/"]').length, 0)
})

function requestPreview({
  caseId,
  revision: requestedRevision,
}: {
  caseId: string
  revision: string
}) {
  return serveChartsCatalogPreview({
    request: new Request(
      `https://tanstack.com/charts/catalog/previews/${requestedRevision}/${caseId}.svg`,
    ),
    params: { caseId, revision: requestedRevision },
  })
}

function createCatalogIndex() {
  return {
    schemaVersion: 1,
    source: {
      repo: 'tanstack/charts',
      pathRoot: 'benchmarks/conformance/',
    },
    cases: [
      {
        schemaVersion: 1,
        order: 1,
        id: '01-line-gaps',
        title: 'Apple stock line with seasonal gaps',
        family: 'trend',
        intent: 'Show gaps in a time series.',
        support: 'native',
        features: ['line', 'missing-values'],
        source: {
          title: 'Observable Plot line mark',
          url: 'https://observablehq.com/plot/marks/line',
        },
        ai: {
          create: 'Create the line chart.',
          maintain: 'Keep the gaps visible.',
        },
        entries: {
          tanstack: 'benchmarks/conformance/cases/01-line-gaps/tanstack.ts',
          reference: {
            renderer: 'observable-plot',
            path: 'benchmarks/conformance/cases/01-line-gaps/plot.ts',
          },
        },
      },
    ],
  }
}
