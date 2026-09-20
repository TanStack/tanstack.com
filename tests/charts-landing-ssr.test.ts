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
      id: 'bar-grouped',
      family: 'bar',
      order: 1,
      title: 'Grouped bars',
    },
    {
      id: '14-error-bars',
      family: 'uncertainty',
      order: 2,
      title: 'Point estimates with error bars',
    },
    {
      id: 'heatmap-labeled',
      family: 'matrix',
      order: 3,
      title: 'Labeled ordinal heatmap',
    },
    {
      id: '70-composed-chart',
      family: 'composition',
      order: 4,
      title: 'Seattle weather with three y axes',
    },
    {
      id: '84-pinned-nested-chart-tooltip',
      family: 'interaction',
      order: 5,
      title: 'Expanding pinned energy tooltip',
    },
    {
      id: '90-zoomable-time-window',
      family: 'interaction',
      order: 6,
      title: 'Wheel zoom and pan over AAPL closes',
    },
    {
      id: '99-comparative-radar',
      family: 'polar',
      order: 7,
      title: 'Comparative radar chart',
    },
    {
      id: '101-sunburst',
      family: 'hierarchy',
      order: 8,
      title: 'Flare analytics sunburst',
    },
    {
      id: '103-bubble-map',
      family: 'geography',
      order: 9,
      title: 'World population bubble map',
    },
    {
      id: '116-geometry-morph',
      family: 'motion',
      order: 10,
      title: 'Cross-chart geometry morph',
    },
    {
      id: '127-shadcn-dashboard',
      family: 'application',
      order: 11,
      title: 'shadcn dashboard',
    },
    {
      id: '131-shadcn-radial-text',
      family: 'radial',
      order: 12,
      title: 'shadcn radial chart with text',
    },
  ],
}

test('the landing hero uses a fixed set of distinct catalog cases', () => {
  assert.equal(
    new Set(chartsLandingHeroCaseIds).size,
    chartsLandingHeroCaseIds.length,
  )
  assert.deepEqual(chartsLandingHeroCaseIds, [
    '70-composed-chart',
    '101-sunburst',
    '127-shadcn-dashboard',
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
  assert.equal(
    $('img[data-catalog-preview-case][loading="lazy"]').length,
    catalog.cases.length + chartsLandingHeroCaseIds.length,
  )
  assert.equal(
    $('img[data-catalog-preview-case][decoding="async"]').length,
    catalog.cases.length + chartsLandingHeroCaseIds.length,
  )
  assert.equal($('.charts-catalog-chart').length, 0)
  assert.equal($('[data-chart-case]').length, 0)
  assert.equal($('[src*="/charts/catalog/assets/"]').length, 0)
})
