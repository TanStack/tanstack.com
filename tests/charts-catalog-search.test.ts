import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChartsCatalogSearch } from '../src/utils/charts-catalog'

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
