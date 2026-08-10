import assert from 'node:assert/strict'
import test from 'node:test'
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import {
  CatalogChartsHero,
  ChartsCatalogGallery,
  chartsLandingHeroCaseIds,
} from '../src/components/landing/ChartsCatalogGallery'
import { shuffleWithSeed } from '../src/utils/utils'

const galleryOrderSeed = 'charts-landing-ssr'
const landingCatalogSsrBudget = {
  rawBytes: 250_000,
  brotliQuality4Bytes: 14_000,
  elements: 1_600,
}
const catalog = {
  revision: 'a'.repeat(40),
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
    {
      id: '04-stacked-time-area',
      family: 'composition',
      order: 4,
      title: 'Stacked Time Area',
    },
    {
      id: '14-error-bars',
      family: 'uncertainty',
      order: 5,
      title: 'Error Bars',
    },
    {
      id: 'heatmap-labeled',
      family: 'matrix',
      order: 6,
      title: 'Labeled Heatmap',
    },
    {
      id: '36-hierarchy-tree',
      family: 'hierarchy',
      order: 7,
      title: 'Hierarchy Tree',
    },
    {
      id: '76-pie',
      family: 'polar',
      order: 8,
      title: 'Pie',
    },
  ],
}

test('the landing hero uses a fixed set of distinct catalog cases', () => {
  assert.equal(
    new Set(chartsLandingHeroCaseIds).size,
    chartsLandingHeroCaseIds.length,
  )
  assert.deepEqual(chartsLandingHeroCaseIds, [
    '03-temperature-range-band',
    'bar-grouped',
    'scatter-bubble',
  ])
})

test('the landing server-renders revision-pinned chart preview assets', () => {
  const shuffledCases = shuffleWithSeed(
    [...catalog.cases].sort((left, right) => left.order - right.order),
    galleryOrderSeed,
    (catalogCase) => catalogCase.id,
  )

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
      children: createElement(Fragment, null, [
        createElement(CatalogChartsHero, { catalog, key: 'hero' }),
        createElement(ChartsCatalogGallery, {
          catalog,
          key: 'gallery',
          orderSeed: galleryOrderSeed,
        }),
      ]),
    }),
  )
  const $ = load(html)
  const rawBytes = Buffer.byteLength(html)
  const brotliQuality4Bytes = brotliCompressSync(html, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
  }).byteLength
  const elements = $('*').length

  assert.ok(rawBytes <= landingCatalogSsrBudget.rawBytes)
  assert.ok(brotliQuality4Bytes <= landingCatalogSsrBudget.brotliQuality4Bytes)
  assert.ok(elements <= landingCatalogSsrBudget.elements)

  const shuffledIds = shuffledCases.map((catalogCase) => catalogCase.id)
  const galleryCards = $('.charts-catalog-gallery-card')
  assert.equal(galleryCards.length, catalog.cases.length)
  assert.deepEqual(
    galleryCards
      .find('a')
      .map((_, element) => $(element).attr('href'))
      .get(),
    shuffledIds.map((caseId) => `/charts/catalog/charts/${caseId}`),
  )
  assert.deepEqual(
    galleryCards
      .find('img[data-catalog-preview-case]')
      .map((_, element) => $(element).attr('data-catalog-preview-case'))
      .get(),
    shuffledIds,
  )

  const hero = $('section[aria-label="Chart catalog examples"]')
  const heroPreviews = hero.find('img[data-catalog-preview-case]')
  assert.deepEqual(
    heroPreviews
      .map((_, element) => $(element).attr('data-catalog-preview-case'))
      .get(),
    [...chartsLandingHeroCaseIds],
  )
  assert.equal(hero.children('.grid').hasClass('grid-cols-2'), true)
  assert.equal(hero.find('figure').first().hasClass('col-span-2'), true)

  assert.equal(
    $('img[src^="/charts/catalog/previews/"]').length,
    catalog.cases.length + chartsLandingHeroCaseIds.length,
  )
  assert.equal($('.charts-catalog-chart').length, 0)
  assert.equal($('[data-chart-case]').length, 0)
  assert.equal($('[src*="/charts/catalog/assets/"]').length, 0)
})
