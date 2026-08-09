import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'

import {
  ChartsCatalogPreview,
  getChartsCatalogPreviewKind,
} from '../src/components/charts/ChartsCatalogPreview'

test('catalog previews prefer case-specific graphics', () => {
  assert.equal(
    getChartsCatalogPreviewKind('03-temperature-range-band', 'range'),
    'range',
  )
  assert.equal(
    getChartsCatalogPreviewKind('bar-grouped', 'bar'),
    'grouped-bars',
  )
  assert.equal(getChartsCatalogPreviewKind('76-pie', 'polar'), 'polar')
  assert.equal(
    getChartsCatalogPreviewKind('111-sankey-flow', 'network'),
    'sankey',
  )
})

test('catalog previews fall back to family graphics', () => {
  assert.equal(getChartsCatalogPreviewKind('new-map', 'geography'), 'map')
  assert.equal(
    getChartsCatalogPreviewKind('new-distribution', 'distribution'),
    'histogram',
  )
  assert.equal(getChartsCatalogPreviewKind('new-family', 'unknown'), 'line')
})

test('catalog previews render a decorative, fixed-viewBox SVG', () => {
  const html = renderToStaticMarkup(
    createElement(ChartsCatalogPreview, {
      caseId: 'heatmap-labeled',
      family: 'matrix',
    }),
  )
  const $ = load(html)
  const preview = $('svg[data-catalog-preview-case="heatmap-labeled"]')

  assert.equal(preview.length, 1)
  assert.equal(preview.attr('data-catalog-preview-kind'), 'heatmap')
  assert.equal(preview.attr('viewBox'), '0 0 288 192')
  assert.equal(preview.attr('aria-hidden'), 'true')
  assert.equal(preview.find('text').length, 0)
})
