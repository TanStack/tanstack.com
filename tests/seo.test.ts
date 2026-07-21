import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCanonicalPath, shouldIndexPath } from '../src/utils/seo'

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
