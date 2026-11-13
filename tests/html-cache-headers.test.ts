import assert from 'node:assert/strict'
import test from 'node:test'
import { applyHtmlCacheHeaders } from '../src/utils/html-cache-headers'

test('a page response a loader made public is kept out of shared caches', () => {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control':
      'public, max-age=300, stale-while-revalidate=3600, stale-if-error=3600',
    'Cloudflare-CDN-Cache-Control':
      'public, max-age=300, stale-while-revalidate=3600',
  })

  applyHtmlCacheHeaders(headers)

  assert.equal(headers.get('Cache-Control'), 'private, no-cache')
  assert.equal(headers.get('Cloudflare-CDN-Cache-Control'), null)
})

test('non-HTML responses keep their cache headers', () => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    'Cloudflare-CDN-Cache-Control':
      'public, max-age=300, stale-while-revalidate=3600',
  })

  applyHtmlCacheHeaders(headers)

  assert.equal(
    headers.get('Cache-Control'),
    'public, max-age=300, stale-while-revalidate=3600',
  )
  assert.equal(
    headers.get('Cloudflare-CDN-Cache-Control'),
    'public, max-age=300, stale-while-revalidate=3600',
  )
})
