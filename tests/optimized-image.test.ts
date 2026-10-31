/// <reference types="node" />

import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { getOptimizedImageUrl } from '../src/utils/optimizedImage'

beforeEach(() => {
  Object.assign(globalThis, {
    __TANSTACK_ENABLE_IMAGE_TRANSFORMATIONS__: true,
    __TANSTACK_SITE_URL__: 'https://tanstack.com',
  })
})

test('resizes media-host posters through the existing image service', () => {
  assert.equal(
    getOptimizedImageUrl(
      'https://media.tanstack.com/blog/tanstack-ai-1-0/v9-title-poster.jpg',
      { width: 640, format: 'auto' },
    ),
    'https://tanstack.com/cdn-cgi/image/width=640,quality=80,format=auto/https://media.tanstack.com/blog/tanstack-ai-1-0/v9-title-poster.jpg',
  )
})

test('does not proxy other hosts or transform an image twice', () => {
  for (const src of [
    'https://example.com/image.jpg',
    'https://media.tanstack.com.example.com/image.jpg',
    '/cdn-cgi/image/width=640,format=auto/images/image.jpg',
  ]) {
    assert.equal(getOptimizedImageUrl(src, { width: 400 }), src)
  }
})

test('keeps original media URLs when transformations are disabled locally', () => {
  Object.assign(globalThis, {
    __TANSTACK_ENABLE_IMAGE_TRANSFORMATIONS__: false,
  })
  const src =
    'https://media.tanstack.com/blog/tanstack-ai-1-0/v9-title-poster.jpg'
  assert.equal(getOptimizedImageUrl(src, { width: 640 }), src)
})
