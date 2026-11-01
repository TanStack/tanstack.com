import assert from 'node:assert/strict'
import test from 'node:test'
import { checkSitemapPage, getSitemapUrls } from '../scripts/check-sitemap'

const url = 'https://tanstack.com/charts/catalog'
const canonical = `<link rel="canonical" href="${url}">`
function check(body = canonical, status = 200, headers = new Headers()) {
  return checkSitemapPage(url, { body, status, headers })
}

test('sitemap parser decodes XML entities and ignores unrelated links', () => {
  assert.deepEqual(
    getSitemapUrls(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://tanstack.com/partners?a=1&amp;b=2</loc></url></urlset>',
    ),
    ['https://tanstack.com/partners?a=1&b=2'],
  )
  assert.deepEqual(getSitemapUrls('<html><a href="/">Home</a></html>'), [])
})

test('contract accepts a healthy self-canonical page and rejects status/canonical failures', () => {
  assert.deepEqual(check(), [])
  assert.ok(
    check(`<html><head></head><body>${canonical}</body></html>`).includes(
      'expected one canonical link, found 0',
    ),
  )
  assert.ok(check(canonical, 307).includes('HTTP 307'))
  assert.ok(check(canonical, 404).includes('HTTP 404'))
  assert.ok(check('').includes('expected one canonical link, found 0'))
  assert.ok(
    check(canonical + canonical).includes(
      'expected one canonical link, found 2',
    ),
  )
  assert.ok(
    check('<link rel="canonical" href="/elsewhere">').includes(
      'canonical does not match sitemap URL',
    ),
  )
  assert.ok(
    check('<link rel="canonical" href="http://[">').includes(
      'invalid canonical URL',
    ),
  )
})

test('contract rejects robots directives, placeholders and forbidden paths', () => {
  assert.ok(
    check(
      canonical + '<meta name="ROBOTS" content="noindex, follow">',
    ).includes('page is noindex'),
  )
  assert.ok(
    check(
      canonical,
      200,
      new Headers({ 'X-Robots-Tag': 'googlebot: none' }),
    ).includes('page is noindex'),
  )
  assert.ok(
    check(canonical + '<h1>Content temporarily unavailable</h1>').includes(
      'error or temporary-unavailable heading',
    ),
  )
  for (const path of [
    '/router/latest/docs/how-to/drafts/test',
    '/db/latest/docs/README',
    '/db/latest/docs/README.md',
    '/router/latest/docs/test.draft',
    '/admin/users',
  ]) {
    const expected = `https://tanstack.com${path}`
    assert.ok(
      checkSitemapPage(expected, {
        body: `<link rel="canonical" href="${expected}">`,
        status: 200,
        headers: new Headers(),
      }).includes('disallowed sitemap path'),
    )
  }
})
