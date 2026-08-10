import assert from 'node:assert/strict'
import test from 'node:test'
import { getRssImageMediaType } from '../src/routes/rss[.]xml'

test('uses the image media type matching an RSS enclosure URL', () => {
  assert.equal(getRssImageMediaType('/header.png'), 'image/png')
  assert.equal(getRssImageMediaType('/header.jpg'), 'image/jpeg')
  assert.equal(getRssImageMediaType('/header.jpeg'), 'image/jpeg')
  assert.equal(getRssImageMediaType('/header.webp'), 'image/webp')
  assert.equal(getRssImageMediaType('/header.svg?v=1'), 'image/svg+xml')
  assert.equal(getRssImageMediaType('/header.gif#image'), 'image/gif')
  assert.equal(
    getRssImageMediaType('/header.unknown'),
    'application/octet-stream',
  )
})
