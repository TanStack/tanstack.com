import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDocsStructuredData } from '../src/utils/docs-structured-data'
import { readDocsFreshness } from '../src/utils/docs-freshness'
import { TANSTACK_ORGANIZATION_ID } from '../src/utils/organization-structured-data'

const library = { id: 'start', name: 'TanStack Start' }
const canonicalHref =
  'https://tanstack.com/start/latest/docs/framework/react/overview'

test('document entities and breadcrumbs use the resolved canonical URL', () => {
  const data = getDocsStructuredData({
    library,
    canonicalHref,
    doc: { title: 'Overview', description: 'Build a full-stack React app.' },
  })
  assert.ok(data)
  const graph = data['@graph']
  const page = graph.find((node) => node['@type'] === 'WebPage')
  const article = graph.find((node) => node['@type'] === 'TechArticle')
  const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList')
  assert.ok(page)
  assert.ok(article && 'headline' in article)
  assert.ok(breadcrumb && 'itemListElement' in breadcrumb)
  assert.equal(page['@id'], canonicalHref)
  assert.deepEqual(article.mainEntityOfPage, { '@id': canonicalHref })
  assert.deepEqual(article.publisher, { '@id': TANSTACK_ORGANIZATION_ID })
  assert.equal(article.headline, 'Overview')
  assert.equal(article.description, 'Build a full-stack React app.')
  assert.deepEqual(breadcrumb.itemListElement, [
    {
      '@type': 'ListItem',
      position: 1,
      name: library.name,
      item: 'https://tanstack.com/start/latest',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Overview',
      item: canonicalHref,
    },
  ])
  for (const field of [
    'author',
    'datePublished',
    'dateModified',
    'aggregateRating',
  ]) {
    assert.equal(field in article, false)
  }
})

test('only validated document freshness supplies a modified date', () => {
  for (const [updated, expected] of [
    ['2026-09-11', '2026-09-11'],
    ['2026-02-30', undefined],
    [undefined, undefined],
  ]) {
    const data = getDocsStructuredData({
      library,
      canonicalHref,
      doc: { title: 'Overview', freshness: readDocsFreshness({ updated }) },
    })
    const article = data?.['@graph'].find(
      (node) => node['@type'] === 'TechArticle',
    )
    assert.ok(article && 'headline' in article)
    assert.equal(article.dateModified, expected)
  }
})

test('missing, untitled, and hidden-library docs emit no structured data', () => {
  assert.deepEqual(
    getDocsStructuredData({ library, canonicalHref, doc: undefined }),
    undefined,
  )
  assert.deepEqual(
    getDocsStructuredData({ library, canonicalHref, doc: { title: '' } }),
    undefined,
  )
  assert.deepEqual(
    getDocsStructuredData({
      library: { ...library, visible: false },
      canonicalHref,
      doc: { title: 'Overview' },
    }),
    undefined,
  )
})
