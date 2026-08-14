import assert from 'node:assert/strict'
import {
  getMenuGroupInitialOpenState,
  isChartsCatalogTarget,
} from '../src/components/library-layout-navigation'

assert.equal(isChartsCatalogTarget('/charts/catalog'), true)
assert.equal(isChartsCatalogTarget('/charts/catalog/charts/01-line'), true)
assert.equal(isChartsCatalogTarget('/charts/catalog/collections/shadcn'), true)
assert.equal(isChartsCatalogTarget('/charts/catalogue'), false)

const groups = [
  {
    label: 'Individual Charts',
    collapsible: true,
    defaultCollapsed: true,
    children: [
      {
        label: 'Line gaps',
        to: '/charts/catalog/charts/01-line-gaps',
      },
    ],
  },
]

assert.deepEqual(
  getMenuGroupInitialOpenState(
    groups,
    undefined,
    '/charts/catalog/charts/01-line-gaps/',
  ),
  { '0:Individual Charts': true },
  'the active catalog detail opens its default-collapsed group',
)

assert.deepEqual(
  getMenuGroupInitialOpenState(groups, undefined, '/charts/catalog'),
  { '0:Individual Charts': false },
  'an inactive catalog group keeps its configured collapsed state',
)

console.log('charts sidebar navigation tests passed')
