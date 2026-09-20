import assert from 'node:assert/strict'
import test from 'node:test'
import { generateRSSFeed, getRssImageMediaType } from '../src/routes/rss[.]xml'
import { getPublishedPosts } from '../src/utils/blog'

test('retrospective partner posts stay out of RSS while regular posts remain', () => {
  const feed = generateRSSFeed()
  const latestRegularPost = getPublishedPosts().find(
    (post) => post.rss !== false,
  )
  assert.ok(latestRegularPost)
  assert.ok(feed.includes(`/blog/${latestRegularPost.slug}`))
  for (const partner of [
    'sentry',
    'clerk',
    'unkey',
    'electric',
    'prisma',
    'coderabbit',
    'cloudflare',
    'workos',
    'railway',
    'serpapi',
    'lovable',
    'render',
  ]) {
    assert.ok(!feed.includes(`/blog/${partner}-partnership`))
  }
})

test('uses the image media type matching an RSS enclosure URL', () => {
  assert.equal(getRssImageMediaType('/header.png'), 'image/png')
  assert.equal(getRssImageMediaType('/header.jpg'), 'image/jpeg')
  assert.equal(getRssImageMediaType('/header.jpeg'), 'image/jpeg')
  assert.equal(getRssImageMediaType('/header.webp'), 'image/webp')
  assert.equal(getRssImageMediaType('/header.svg?v=1'), 'image/svg+xml')
  assert.equal(getRssImageMediaType('/header.gif#image'), 'image/gif')
  assert.equal(
    getRssImageMediaType('/header?source=original.png'),
    'application/octet-stream',
  )
  assert.equal(
    getRssImageMediaType('/header#preview.jpg'),
    'application/octet-stream',
  )
  assert.equal(
    getRssImageMediaType('/header.unknown'),
    'application/octet-stream',
  )
})
