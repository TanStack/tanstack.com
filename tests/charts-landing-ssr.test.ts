import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
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
import { catalogCases } from '@tanstack/react-charts-catalog'

import {
  ChartsLandingCatalogChart,
  chartsLandingCaseIds,
  chartsLandingInitialCaseIds,
} from '../src/components/charts/ChartsLandingCatalogChart'
import { chartsLandingCatalogAssetRevision } from '../src/components/charts/chartsLandingCatalogAssets'
import {
  CatalogChartsHero,
  ChartsCatalogGallery,
  chartsLandingHeroCaseIdsByTile,
  chartsLandingInitialHeroCaseIds,
} from '../src/components/landing/ChartsCatalogGallery'
import { shuffleWithSeed } from '../src/utils/utils'

const landingCatalogSsrBudget = {
  rawBytes: 250_000,
  brotliQuality4Bytes: 14_000,
  elements: 1_600,
}

const expectedHeroCaseIds = [
  '03-temperature-range-band',
  'bar-grouped',
  'bar-vertical-sorted',
  'bar-stacked',
  'scatter-bubble',
  '14-error-bars',
  '01-line-gaps',
  '04-stacked-time-area',
] as const
const galleryOrderSeed = 'charts-landing-ssr'

test('the initial hero charts server-render at both layout ratios', () => {
  assert.deepEqual(chartsLandingCaseIds, expectedHeroCaseIds)
  assert.deepEqual(chartsLandingInitialCaseIds, [
    '03-temperature-range-band',
    'bar-grouped',
    'bar-vertical-sorted',
    'bar-stacked',
  ])

  for (const caseId of chartsLandingInitialCaseIds) {
    for (const aspectRatio of [1.5, 3]) {
      const html = renderToStaticMarkup(
        createElement(ChartsLandingCatalogChart, {
          aspectRatio,
          caseId,
          idPrefix: `ssr-${caseId}-${aspectRatio}`,
          initialWidth: 288,
          interactive: false,
          preview: true,
        }),
      )

      assert.match(html, /class="ts-chart(?:\s|")/)
      assert.match(
        html,
        new RegExp(`viewBox="0 0 288 ${aspectRatio === 3 ? 96 : 192}"`),
      )
      assert.doesNotMatch(html, /animate-pulse|Render failed/)
      assert.doesNotMatch(html, /data-ts-focus-layer/)
    }
  }
})

test('hero tiles rotate through disjoint chart pools', () => {
  assert.deepEqual(
    chartsLandingHeroCaseIdsByTile.map((caseIds) => caseIds[0]),
    chartsLandingInitialCaseIds,
  )

  const assignedCaseIds = chartsLandingHeroCaseIdsByTile.flat()
  assert.equal(new Set(assignedCaseIds).size, assignedCaseIds.length)
  assert.deepEqual(
    [...assignedCaseIds].sort(),
    [...chartsLandingCaseIds].sort(),
  )

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

test('all 110 gallery snapshots are safe 288 by 192 SVG assets', () => {
  const metadataIds = catalogCases.map((catalogCase) => catalogCase.id)
  const assetDirectory = resolve(process.cwd(), 'public/images/charts/catalog')
  const assetFiles = readdirSync(assetDirectory)
    .filter((filename) => filename.endsWith('.svg'))
    .sort()

  assert.equal(metadataIds.length, 110)
  assert.ok(metadataIds.includes('119-stacked-bar-band-cursor'))
  assert.deepEqual(
    assetFiles,
    metadataIds.map((caseId) => `${caseId}.svg`).sort(),
  )

  for (const caseId of metadataIds) {
    const assetFile = resolve(assetDirectory, `${caseId}.svg`)
    assert.equal(existsSync(assetFile), true, `Missing SVG for ${caseId}.`)

    const svg = readFileSync(assetFile, 'utf8')
    assert.match(svg, /^<svg\b/)
    assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.match(svg, /viewBox="0 0 288 192"/)
    assert.match(svg, /:root\{--ts-chart-background:#ffffff;/)
    assert.match(
      svg,
      /@media\(prefers-color-scheme:dark\)\{:root\{--ts-chart-background:#071219;/,
    )
    assert.doesNotMatch(svg.slice(0, svg.indexOf('>') + 1), /--ts-chart-/)
    assert.doesNotMatch(svg, /<script\b/i)
  }
})

test('the landing server-renders static gallery previews and live hero charts', () => {
  const metadataIds = catalogCases.map((catalogCase) => catalogCase.id)
  const shuffledCases = shuffleWithSeed(
    [...catalogCases].sort((left, right) => left.order - right.order),
    galleryOrderSeed,
    (catalogCase) => catalogCase.id,
  )
  const shuffledIds = shuffledCases.map((catalogCase) => catalogCase.id)
  assert.equal(chartsLandingInitialHeroCaseIds.length, 4)
  assert.deepEqual(chartsLandingInitialHeroCaseIds, chartsLandingInitialCaseIds)

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
      createElement(CatalogChartsHero, { key: 'hero' }),
      createElement(ChartsCatalogGallery, {
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

  assert.doesNotMatch(html, /aspect-ratio:1\.5px/)

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

  const galleryCards = $('.charts-catalog-gallery-card')
  assert.equal(galleryCards.length, metadataIds.length)
  assert.equal(
    galleryCards.filter('.charts-catalog-card').length,
    metadataIds.length,
  )
  assert.equal($('[class~="charts-catalog-card-light"]').length, 0)
  assert.equal($('[class~="charts-catalog-card-dark"]').length, 0)
  assert.deepEqual(
    galleryCards
      .find('a')
      .map((_, element) => $(element).attr('href'))
      .get(),
    shuffledIds.map((caseId) => `/charts/catalog/charts/${caseId}`),
  )
  const galleryImages = $('.charts-catalog-gallery-card img')
  assert.equal(galleryImages.length, metadataIds.length)
  assert.equal(
    galleryImages.filter(
      '[loading="lazy"][decoding="async"][width="288"][height="192"]',
    ).length,
    metadataIds.length,
  )
  assert.deepEqual(
    galleryImages.map((_, element) => $(element).attr('src')).get(),
    shuffledIds.map(
      (caseId) =>
        `/images/charts/catalog/${caseId}.svg?v=${chartsLandingCatalogAssetRevision}`,
    ),
  )
  assert.equal($('.charts-catalog-gallery-card .ts-chart').length, 0)
  assert.equal(
    $('.charts-catalog-gallery-card .charts-catalog-chart').length,
    0,
  )

  const heroRenderCount = chartsLandingInitialHeroCaseIds.length
  assert.equal($('.charts-catalog-hero-frame').length, heroRenderCount)
  const heroRenderedCaseIds = $('.charts-catalog-hero-frame [data-chart-case]')
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
  assert.equal(
    $('.charts-catalog-hero-frame').filter((_, element) =>
      $(element).find('svg.ts-chart').is('svg'),
    ).length,
    heroRenderCount,
  )
  assert.equal(
    $('.charts-catalog-hero-frame svg.ts-chart').length,
    heroRenderCount,
  )
  assert.equal($('.charts-catalog-chart').length, heroRenderCount)
  assert.equal(
    $('[class~="aspect-[3/2]"]').length,
    metadataIds.length + chartsLandingInitialHeroCaseIds.length - 1,
  )
  assert.equal($('.charts-catalog-chart.h-full.w-full').length, heroRenderCount)
  assert.equal($('.charts-catalog-chart[style*="aspect-ratio"]').length, 0)
  assert.equal(
    $('.charts-catalog-chart').filter((_, element) =>
      $(element).find('[style*="aspect-ratio:1.5"]').is('[style]'),
    ).length,
    chartsLandingInitialHeroCaseIds.length - 1,
  )
  assert.equal(
    $('.charts-catalog-chart').filter((_, element) =>
      $(element).find('[style*="aspect-ratio:3"]').is('[style]'),
    ).length,
    1,
  )
})
