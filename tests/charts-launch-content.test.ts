import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { allPosts } from '../.content-collections/generated/index.js'
import { getPublishedPosts, postToBlogCardPost } from '../src/utils/blog'

test('Charts launch video has a card poster and is published', () => {
  const post = allPosts.find((post) => post.slug === 'tanstack-charts-1-0')
  assert.ok(post)
  assert.equal(post.draft, false)
  assert.equal(post.published, '2026-10-05')
  assert.equal(post.headerImage, '/blog-assets/tanstack-charts-1-0/poster.jpg')
  assert.equal(
    post.headerVideo,
    '/blog-assets/tanstack-charts-1-0/tanstack-charts-continuing-finale.mp4',
  )
  assert.equal(postToBlogCardPost(post).headerImage, post.headerImage)
  assert.ok(
    getPublishedPosts().some((post) => post.slug === 'tanstack-charts-1-0'),
  )
})

test('Charts launch uses the approved V8 video unchanged', () => {
  const video = readFileSync(
    'public/blog-assets/tanstack-charts-1-0/tanstack-charts-continuing-finale.mp4',
  )
  assert.equal(video.length, 6317617)
  assert.equal(
    createHash('sha256').update(video).digest('hex'),
    '4b5f30e63f6f0ae45ee064910ac8025c9c1f5398ba108c13446c9d6c879afc93',
  )
})
