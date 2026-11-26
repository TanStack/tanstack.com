import assert from 'node:assert/strict'
import { test } from 'node:test'
import { finalizeDocsHtmlHeaders } from '../src/utils/docs-html-headers.server'

const url = 'https://tanstack.com/router/latest/docs/routing/routing-concepts'
test('HTML headers override loader headers without enabling page caching', () => {
  const response = finalizeDocsHtmlHeaders(
    new Request(url, { headers: { Accept: 'text/html' } }),
    new Response('docs', {
      headers: {
        'X-Docs-Html': '1',
        'Cache-Control': 'public, max-age=0',
        'Cache-Tag': 'docs-config:all',
      },
    }),
  )
  assert.equal(response.headers.has('X-Docs-Html'), false)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store')
  assert.match(
    response.headers.get('Cache-Tag') ?? '',
    /docs:router:branch:main/,
  )
  assert.match(
    response.headers.get('Cache-Tag') ?? '',
    /docs-config:tanstack\/router:main/,
  )
})
test('fallback and authenticated HTML stay uncacheable even with conflicting loader headers', () => {
  for (const marker of ['1', 'no-store']) {
    const response = finalizeDocsHtmlHeaders(
      new Request(url, {
        headers: { Cookie: 'session_token=x', Accept: 'text/html' },
      }),
      new Response('docs', {
        headers: {
          'X-Docs-Html': marker,
          'Cache-Control': 'public, max-age=3600',
        },
      }),
    )
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(
      response.headers.get('Cloudflare-CDN-Cache-Control'),
      'no-store',
    )
  }
})
