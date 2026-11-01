import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getChartBreadcrumbItems,
  getChartBreadcrumbJsonLd,
} from '../src/utils/chart-breadcrumbs'
Object.assign(globalThis, { __TANSTACK_SITE_URL__: 'https://tanstack.com' })

test('chart hierarchy includes only known collections and keeps navigation options out of canonical URLs', () => {
  const chart = {
    id: 'area-simple',
    title: 'Area <simple>',
    collection: 'shadcn',
  }
  const items = getChartBreadcrumbItems(chart)
  assert.deepEqual(
    items.map((item) => item.label),
    ['Catalog', 'shadcn/ui Charts', 'Area <simple>'],
  )
  assert.equal(items[1].search, true)
  assert.equal(items[1].preload, false)
  const schema = getChartBreadcrumbJsonLd(chart)
  assert.deepEqual(
    schema.itemListElement.map((item) => item.position),
    [1, 2, 3],
  )
  assert.equal(
    schema.itemListElement[2].item,
    'https://tanstack.com/charts/catalog/charts/area-simple',
  )
  for (const collection of [undefined, 'unknown']) {
    assert.equal(getChartBreadcrumbItems({ ...chart, collection }).length, 2)
  }
})
