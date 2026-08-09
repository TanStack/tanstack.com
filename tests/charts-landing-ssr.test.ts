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
  chartsLandingHeroCaseIdsByTile,
  chartsLandingInitialHeroCaseIds,
} from '../src/components/landing/ChartsCatalogGallery'
import { getChartsCatalogPreviewUrl } from '../src/utils/charts-catalog'
import { shuffleWithSeed } from '../src/utils/utils'

const artifactRevision = '2'.repeat(40)
const galleryOrderSeed = 'charts-landing-ssr'
const landingCatalogSsrBudget = {
  rawBytes: 250_000,
  brotliQuality4Bytes: 14_000,
  elements: 1_600,
}
const expectedHeroCaseIds = [
  '03-temperature-range-band',
  '01-line-gaps',
  'bar-grouped',
  '04-stacked-time-area',
  'bar-vertical-sorted',
  '14-error-bars',
  'bar-stacked',
  'scatter-bubble',
] as const

type LandingCatalog = {
  artifactRevision: string
  cases: Array<{
    id: string
    family: string
    order: number
    title: string
    module: { path: string; preload: Array<string> }
    preview: {
      path: string
      mediaType: 'image/svg+xml'
      width: 288
      height: 192
      bytes: number
      sha256: string
    }
  }>
}

const catalog: LandingCatalog = {
  artifactRevision,
  cases: expectedHeroCaseIds.map((id, index) => {
    const sha256 = (index + 1).toString(16).padStart(64, '0')
    return {
      id,
      family: index % 2 === 0 ? 'cartesian' : 'statistical',
      order: index + 1,
      title: id
        .split('-')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' '),
      module: {
        path: `assets/${id}-${sha256}.js`,
        preload: [],
      },
      preview: {
        path: `previews/${id}-${sha256}.svg`,
        mediaType: 'image/svg+xml',
        width: 288,
        height: 192,
        bytes: 1_024 + index,
        sha256,
      },
    }
  }),
}

test('hero tiles rotate through disjoint chart pools', () => {
  assert.deepEqual(
    chartsLandingHeroCaseIdsByTile.map((caseIds) => caseIds[0]),
    chartsLandingInitialHeroCaseIds,
  )

  const assignedCaseIds = chartsLandingHeroCaseIdsByTile.flat()
  assert.equal(new Set(assignedCaseIds).size, assignedCaseIds.length)
  assert.deepEqual([...assignedCaseIds].sort(), [...expectedHeroCaseIds].sort())

  const combinations = chartsLandingHeroCaseIdsByTile.reduce<
    Array<Array<string>>
  >(
    (rows, pool) =>
      rows.flatMap((row) => pool.map((caseId) => [...row, caseId])),
    [[]],
  )
  for (const combination of combinations) {
    assert.equal(new Set(combination).size, combination.length)
  }
})

test('the landing server-renders artifact previews before live hero charts mount', () => {
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
  const routerProviderProps = {
    router,
    children: createElement(Fragment, null, [
      createElement(CatalogChartsHero, { catalog, key: 'hero' }),
      createElement(ChartsCatalogGallery, {
        catalog,
        key: 'gallery',
        orderSeed: galleryOrderSeed,
      }),
    ]),
  }
  const renderStartedAt = performance.now()
  const html = renderToStaticMarkup(
    createElement(RouterContextProvider<typeof router>, routerProviderProps),
  )
  const renderDurationMs = performance.now() - renderStartedAt
  const $ = load(html)
  const rawBytes = Buffer.byteLength(html)
  const brotliQuality4Bytes = brotliCompressSync(html, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
  }).byteLength
  const elements = $('*').length

  assert.ok(
    rawBytes <= landingCatalogSsrBudget.rawBytes,
    `Landing catalog SSR is ${rawBytes} raw bytes after ${renderDurationMs.toFixed(1)}ms.`,
  )
  assert.ok(
    brotliQuality4Bytes <= landingCatalogSsrBudget.brotliQuality4Bytes,
    `Landing catalog SSR is ${brotliQuality4Bytes} Brotli quality-4 bytes.`,
  )
  assert.ok(
    elements <= landingCatalogSsrBudget.elements,
    `Landing catalog SSR contains ${elements} elements.`,
  )

  const shuffledIds = shuffledCases.map((catalogCase) => catalogCase.id)
  const galleryCards = $('.charts-catalog-gallery-card')
  const galleryImages = galleryCards.find('img')
  assert.equal(galleryCards.length, catalog.cases.length)
  assert.equal(
    galleryCards.filter('.charts-catalog-card').length,
    catalog.cases.length,
  )
  assert.deepEqual(
    galleryCards
      .find('a')
      .map((_, element) => $(element).attr('href'))
      .get(),
    shuffledIds.map((caseId) => `/charts/catalog/charts/${caseId}`),
  )
  assert.equal(galleryImages.length, catalog.cases.length)
  assert.equal(
    galleryImages.filter(
      '[loading="lazy"][decoding="async"][width="288"][height="192"]',
    ).length,
    catalog.cases.length,
  )
  assert.deepEqual(
    galleryImages.map((_, element) => $(element).attr('src')).get(),
    shuffledCases.map((catalogCase) =>
      getChartsCatalogPreviewUrl(artifactRevision, catalogCase.preview.path),
    ),
  )
  assert.equal(
    $('.charts-catalog-gallery-card .charts-catalog-chart').length,
    0,
  )

  const heroRenderCount = chartsLandingInitialHeroCaseIds.length
  const heroFrames = $('.charts-catalog-hero-frame')
  const heroImages = heroFrames.find('img')
  assert.equal(heroFrames.length, heroRenderCount)
  assert.equal(heroImages.length, heroRenderCount)
  assert.deepEqual(
    heroImages.map((_, element) => $(element).attr('src')).get(),
    chartsLandingInitialHeroCaseIds.map((caseId) => {
      const catalogCase = catalog.cases.find((entry) => entry.id === caseId)
      assert.ok(catalogCase)
      return getChartsCatalogPreviewUrl(
        artifactRevision,
        catalogCase.preview.path,
      )
    }),
  )
  assert.equal($('.charts-catalog-chart').length, heroRenderCount)
  assert.equal($('.charts-catalog-hero-frame .ts-chart').length, 0)
  assert.equal(
    heroImages.filter('[width="288"][height="192"]').length,
    heroRenderCount,
  )
  assert.equal($('img[src^="/images/charts/catalog/"]').length, 0)

  const heroRenderedCaseIds = heroFrames
    .find('[data-chart-case]')
    .map((_, element) => $(element).attr('data-chart-case'))
    .get()
  assert.equal(new Set(heroRenderedCaseIds).size, heroRenderedCaseIds.length)
  const heroSection = $('section[aria-label="Rotating chart catalog examples"]')
  const heroGrid = heroSection.children('.grid').first()
  const heroFigures = heroGrid.children('figure')
  assert.equal(heroGrid.hasClass('lg:grid-cols-3'), true)
  assert.equal(heroGrid.hasClass('xl:grid-cols-2'), true)
  assert.equal(heroFigures.first().hasClass('xl:col-span-2'), true)
  assert.equal(heroFigures.first().hasClass('hidden'), true)
  assert.equal(heroFigures.first().hasClass('xl:block'), true)
  assert.equal(heroFigures.first().find('[class~="aspect-[3/1]"]').length, 1)
  assert.equal(heroFigures.eq(1).hasClass('xl:hidden'), true)
})
