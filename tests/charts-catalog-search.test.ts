import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultParseSearch } from '@tanstack/react-router'
import {
  parseChartsCatalogRouteSearch,
  parseChartsCatalogSearch,
  validateChartsCatalogRouteSearch,
} from '../src/utils/charts-catalog'
import {
  parseChartsCatalogEmbedRouteSearch,
  validateChartsCatalogEmbedRouteSearch,
} from '../src/utils/charts-catalog-embed'

test('catalog comparison mode requires one exact compare=1 parameter', () => {
  for (const search of ['?compare=1', 'compare=1', '?view=all&compare=1']) {
    assert.equal(
      parseChartsCatalogSearch(search).comparison,
      true,
      `${search} should enable comparison mode`,
    )
  }

  for (const search of [
    '',
    '?',
    '?compare',
    '?compare=',
    '?compare=0',
    '?compare=true',
    '?compare=01',
    '?Compare=1',
    '?compare=1&compare=1',
    '?compare=0&compare=1',
    '?compare=1&compare=0',
    '?compare=%5B1%5D',
    '?compare=%5B%221%22%5D',
  ]) {
    assert.equal(
      parseChartsCatalogSearch(search).comparison,
      false,
      `${search || '(empty)'} should keep comparisons disabled`,
    )
  }
})

test('catalog embeds never enable comparison modules', () => {
  assert.equal(
    parseChartsCatalogSearch('?compare=1', { embed: true }).comparison,
    false,
  )
})

test('validated catalog search preserves exact comparison loader deps', () => {
  for (const value of ['1', 1]) {
    const search = validateChartsCatalogRouteSearch({ compare: value })
    assert.equal(parseChartsCatalogRouteSearch(search).comparison, true)
  }

  for (const value of [
    undefined,
    '',
    '0',
    'true',
    true,
    1.1,
    ['1'],
    [1],
    ['1', '1'],
    [1, 1],
    ['0', '1'],
  ]) {
    const search = validateChartsCatalogRouteSearch({ compare: value })
    assert.equal(parseChartsCatalogRouteSearch(search).comparison, false)
  }
})

test('Router-decoded array values never enable catalog comparison mode', () => {
  for (const value of ['%5B1%5D', '%5B%221%22%5D']) {
    const decoded = defaultParseSearch(`?compare=${value}`)
    const search = validateChartsCatalogRouteSearch(decoded)
    assert.equal(parseChartsCatalogRouteSearch(search).comparison, false)
  }
})

test('validated embed search produces stable loader deps', () => {
  assert.deepEqual(
    parseChartsCatalogEmbedRouteSearch(
      validateChartsCatalogEmbedRouteSearch({
        height: 420,
        revision: 3,
        source: 'expanded',
        theme: 'dark',
      }),
    ),
    {
      height: 420,
      revision: 3,
      source: 'expanded',
      theme: 'dark',
    },
  )
  assert.deepEqual(
    parseChartsCatalogEmbedRouteSearch(
      validateChartsCatalogEmbedRouteSearch({
        height: ['420', '421'],
        revision: '-1',
        source: ['expanded'],
        theme: ['dark'],
      }),
    ),
    {
      height: 480,
      revision: 0,
      source: 'hidden',
      theme: 'system',
    },
  )
})
