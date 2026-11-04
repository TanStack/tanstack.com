import assert from 'node:assert/strict'
import { test } from 'node:test'
import { query, workflow } from '../src/libraries'
import {
  getLibraryBreadcrumbItems,
  getLibraryBreadcrumbJsonLd,
} from '../src/utils/library-breadcrumbs'
Object.assign(globalThis, { __TANSTACK_SITE_URL__: 'https://tanstack.com' })

test('public library landing trail shares labels and canonical destinations', () => {
  assert.deepEqual(getLibraryBreadcrumbItems(query), [
    { label: 'Libraries', to: '/libraries' },
    { label: 'TanStack Query', to: '/query/latest' },
  ])
  assert.deepEqual(getLibraryBreadcrumbJsonLd(query)?.itemListElement, [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Libraries',
      item: 'https://tanstack.com/libraries',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'TanStack Query',
      item: 'https://tanstack.com/query/latest',
    },
  ])
})
test('hidden library emits neither a visible trail nor structured data', () => {
  assert.equal(getLibraryBreadcrumbItems(workflow), undefined)
  assert.equal(getLibraryBreadcrumbJsonLd(workflow), undefined)
})

test('library without a landing destination has no breadcrumb trail', () => {
  assert.equal(
    getLibraryBreadcrumbItems({ name: 'Unlinked library' }),
    undefined,
  )
  assert.equal(
    getLibraryBreadcrumbJsonLd({ name: 'Unlinked library' }),
    undefined,
  )
})
