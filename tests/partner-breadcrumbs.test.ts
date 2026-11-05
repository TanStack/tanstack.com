import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getPartnerBreadcrumbItems,
  getPartnerBreadcrumbJsonLd,
} from '../src/utils/partner-breadcrumbs'

Object.assign(globalThis, { __TANSTACK_SITE_URL__: 'https://tanstack.com' })

test('partner breadcrumbs share the visible labels and canonical destinations', () => {
  const partner = { id: 'ag-grid', name: 'AG Grid' }
  const items = getPartnerBreadcrumbItems(partner)
  assert.deepEqual(items, [
    { label: 'Partners', to: '/partners' },
    { label: 'AG Grid', to: '/partners/ag-grid' },
  ])
  assert.deepEqual(getPartnerBreadcrumbJsonLd(partner), {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Partners',
        item: 'https://tanstack.com/partners',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AG Grid',
        item: 'https://tanstack.com/partners/ag-grid',
      },
    ],
  })
})
