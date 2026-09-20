import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canGoBackInExamplePreview,
  canGoForwardInExamplePreview,
  createExamplePreviewHistory,
  normalizeExamplePreviewUrl,
  updateExamplePreviewHistory,
} from '../src/utils/example-preview-history'

test('tracks pushes, replacements, and traversal without duplicating reloads', () => {
  let history = createExamplePreviewHistory('/')
  history = updateExamplePreviewHistory(history, {
    kind: 'push',
    url: '/reports',
  })
  history = updateExamplePreviewHistory(history, {
    kind: 'replace',
    url: '/reports?range=week',
  })
  history = updateExamplePreviewHistory(history, {
    kind: 'load',
    url: '/reports?range=week',
  })

  assert.deepEqual(history, {
    entries: ['/', '/reports?range=week'],
    index: 1,
  })
  assert.equal(canGoBackInExamplePreview(history), true)
  assert.equal(canGoForwardInExamplePreview(history), false)

  history = updateExamplePreviewHistory(history, { kind: 'pop', url: '/' })
  assert.equal(history.index, 0)
  assert.equal(canGoForwardInExamplePreview(history), true)
})

test('a push after going back discards the forward branch', () => {
  let history = createExamplePreviewHistory('/')
  history = updateExamplePreviewHistory(history, {
    kind: 'push',
    url: '/one',
  })
  history = updateExamplePreviewHistory(history, {
    kind: 'push',
    url: '/two',
  })
  history = updateExamplePreviewHistory(history, { kind: 'pop', url: '/one' })
  history = updateExamplePreviewHistory(history, {
    kind: 'push',
    url: '/three',
  })

  assert.deepEqual(history, { entries: ['/', '/one', '/three'], index: 2 })
})

test('accepts only locations owned by the active preview', () => {
  assert.equal(
    normalizeExamplePreviewUrl({ mode: 'client', url: '#details' }),
    '#details',
  )
  assert.equal(
    normalizeExamplePreviewUrl({ mode: 'client', url: 'https://example.com' }),
    undefined,
  )
  assert.equal(
    normalizeExamplePreviewUrl({
      mode: 'webcontainer',
      previewUrl: 'https://preview.local/',
      url: '/reports',
    }),
    'https://preview.local/reports',
  )
  assert.equal(
    normalizeExamplePreviewUrl({
      mode: 'webcontainer',
      previewUrl: 'https://preview.local/',
      url: 'https://example.com/phishing',
    }),
    undefined,
  )
})
