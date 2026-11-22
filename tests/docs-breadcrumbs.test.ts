import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDocsBreadcrumbItems } from '../src/utils/docs-breadcrumbs'
import { getDocsStructuredData } from '../src/utils/docs-structured-data'

test('visible and schema trails share labels, ordering and canonical destinations', () => {
  for (const canonicalHref of [
    'https://tanstack.com/query/latest/docs/framework/react/guides/query-keys',
    'https://tanstack.com/query/v3/docs/overview',
  ]) {
    const input = {
      doc: { title: 'Query keys <script>' },
      library: { id: 'query', name: 'TanStack Query' },
      canonicalHref,
    }
    const items = getDocsBreadcrumbItems(input)
    const schema = getDocsStructuredData(input)?.['@graph'].find(
      (node) => node['@type'] === 'BreadcrumbList',
    )
    assert.ok(items)
    assert.ok(schema && 'itemListElement' in schema)
    assert.equal(items.length, 3)
    assert.equal(items.at(-1)?.label, input.doc.title)
    assert.equal(items.at(-1)?.to, canonicalHref)
    assert.deepEqual(
      schema.itemListElement,
      items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        item: new URL(item.to, canonicalHref).href,
      })),
    )
  }
})

test('hidden, missing and untitled documents have no semantic trail', () => {
  const input = {
    library: { id: 'workflow', name: 'Workflow', visible: false },
    canonicalHref: 'https://tanstack.com/workflow/latest/docs/overview',
  }
  assert.equal(
    getDocsBreadcrumbItems({ ...input, doc: { title: 'Overview' } }),
    undefined,
  )
  assert.equal(
    getDocsBreadcrumbItems({
      ...input,
      library: { ...input.library, visible: true },
      doc: undefined,
    }),
    undefined,
  )
  assert.equal(
    getDocsBreadcrumbItems({
      ...input,
      library: { ...input.library, visible: true },
      doc: { title: '' },
    }),
    undefined,
  )
})
