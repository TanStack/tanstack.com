import assert from 'node:assert/strict'
import test from 'node:test'
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

import {
  ChartsCatalogPreview,
  chartsCatalogPreviewCaseIds,
  getChartsCatalogPreviewKind,
} from '../src/components/charts/ChartsCatalogPreview'

const allPreviewBudget = {
  brotliQuality4Bytes: 40_000,
  elements: 3_000,
  rawBytes: 300_000,
}

test('catalog previews fall back to family graphics', () => {
  assert.equal(getChartsCatalogPreviewKind('new-map', 'geography'), 'map')
  assert.equal(
    getChartsCatalogPreviewKind('new-distribution', 'distribution'),
    'histogram',
  )
  assert.equal(getChartsCatalogPreviewKind('new-family', 'unknown'), 'line')
})

test('known catalog previews render source-specific geometry', () => {
  const grouped = load(
    renderToStaticMarkup(
      createElement(ChartsCatalogPreview, {
        caseId: 'bar-grouped',
        family: 'bar',
      }),
    ),
  )
  const stacked = load(
    renderToStaticMarkup(
      createElement(ChartsCatalogPreview, {
        caseId: 'bar-stacked',
        family: 'bar',
      }),
    ),
  )

  assert.equal(grouped('[data-preview-geometry="grouped-bars"]').length, 1)
  assert.equal(stacked('[data-preview-geometry="bar-stacked"]').length, 1)
  assert.notEqual(grouped('svg').html(), stacked('svg').html())
})

test('every current catalog case has an exact preview', () => {
  assert.equal(chartsCatalogPreviewCaseIds.length, 110)
  assert.equal(new Set(chartsCatalogPreviewCaseIds).size, 110)

  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      chartsCatalogPreviewCaseIds.map((caseId) =>
        createElement(ChartsCatalogPreview, {
          caseId,
          family: 'unknown',
          key: caseId,
        }),
      ),
    ),
  )
  const $ = load(html)

  assert.equal(
    $('svg[data-catalog-preview-kind="case"]').length,
    chartsCatalogPreviewCaseIds.length,
  )
  assert.ok(Buffer.byteLength(html) <= allPreviewBudget.rawBytes)
  assert.ok(
    brotliCompressSync(html, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    }).byteLength <= allPreviewBudget.brotliQuality4Bytes,
  )
  assert.ok($('*').length <= allPreviewBudget.elements)
})

test('part-to-whole, geography, and interaction previews stay distinct', () => {
  const render = (caseId: string, family: string) =>
    load(
      renderToStaticMarkup(
        createElement(ChartsCatalogPreview, { caseId, family }),
      ),
    )('svg').html()

  assert.notEqual(render('76-pie', 'polar'), render('77-donut', 'polar'))
  assert.notEqual(render('77-donut', 'polar'), render('78-gauge', 'polar'))
  assert.notEqual(
    render('102-world-choropleth', 'geography'),
    render('103-bubble-map', 'geography'),
  )
  assert.notEqual(
    render('83-focus-context-window', 'interaction'),
    render('88-echarts-free-cursor', 'interaction'),
  )
})

test('catalog previews retain feature-defining labels', () => {
  const html = renderToStaticMarkup(
    createElement(ChartsCatalogPreview, {
      caseId: 'heatmap-labeled',
      family: 'matrix',
    }),
  )
  const $ = load(html)
  const preview = $('svg[data-catalog-preview-case="heatmap-labeled"]')

  assert.equal(preview.length, 1)
  assert.equal(preview.attr('data-catalog-preview-kind'), 'case')
  assert.equal(preview.attr('viewBox'), '0 0 288 192')
  assert.equal(preview.attr('aria-hidden'), 'true')
  assert.equal(preview.attr('focusable'), 'false')
  assert.equal(
    preview.find('[data-preview-geometry="labeled-heatmap"]').length,
    1,
  )
  assert.ok(preview.find('text').length > 0)
})
