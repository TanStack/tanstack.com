import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCanonicalPath, seo, shouldIndexPath } from '../src/utils/seo'

test('public partner pages remain indexable', () => {
  assert.equal(shouldIndexPath('/partners'), true)
  assert.equal(shouldIndexPath('/partners/cloudflare'), true)
})

test('transparent embed pages are not indexed', () => {
  for (const path of ['/partners-embed', '/sponsors-embed']) {
    assert.equal(getCanonicalPath(path), null)
    assert.equal(shouldIndexPath(path), false)
  }
})

test('social metadata identifies TanStack and describes its image', () => {
  const title = 'TanStack Query'
  const tags = seo({
    title,
    image: 'https://tanstack.com/api/og/query.png',
  })

  assert.ok(
    tags.some(
      (tag) => tag.name === 'twitter:site' && tag.content === '@tan_stack',
    ),
  )
  assert.ok(
    tags.some(
      (tag) => tag.property === 'og:site_name' && tag.content === 'TanStack',
    ),
  )
  assert.ok(
    tags.some(
      (tag) => tag.property === 'og:image:alt' && tag.content === title,
    ),
  )
})
