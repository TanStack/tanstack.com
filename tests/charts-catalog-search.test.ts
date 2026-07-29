import assert from 'node:assert/strict'
import test from 'node:test'
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
  for (const value of ['1', ['1']]) {
    const search = validateChartsCatalogRouteSearch({ compare: value })
    assert.equal(parseChartsCatalogRouteSearch(search).comparison, true)
  }

  for (const value of [undefined, '', '0', 'true', ['1', '1'], ['0', '1'], 1]) {
    const search = validateChartsCatalogRouteSearch({ compare: value })
    assert.equal(parseChartsCatalogRouteSearch(search).comparison, false)
  }
})

test('validated embed search produces stable loader deps', () => {
  assert.deepEqual(
    parseChartsCatalogEmbedRouteSearch(
      validateChartsCatalogEmbedRouteSearch({
        height: '420',
        revision: '3',
        theme: 'dark',
      }),
    ),
    {
      height: 420,
      revision: 3,
      theme: 'dark',
    },
  )
  assert.deepEqual(
    parseChartsCatalogEmbedRouteSearch(
      validateChartsCatalogEmbedRouteSearch({
        height: ['420', '421'],
        revision: '-1',
        theme: ['dark'],
      }),
    ),
    {
      height: 360,
      revision: 0,
      theme: 'system',
    },
  )
})
