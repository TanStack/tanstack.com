import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productionOrigin, resolveAppUrl } from './runtime-config.mjs'

test('packaged app ignores development origin overrides', () => {
  assert.equal(
    resolveAppUrl({ packaged: true, developmentUrl: 'http://127.0.0.1:4317/' })
      .origin,
    productionOrigin,
  )
})
test('development permits the fixture origin', () => {
  assert.equal(
    resolveAppUrl({ packaged: false, developmentUrl: 'http://127.0.0.1:4317/' })
      .port,
    '4317',
  )
})
test('rejects credentials, insecure remote hosts, and non-origin development URLs', () => {
  for (const developmentUrl of [
    'http://example.com',
    'https://user:pass@example.com',
    'file:///tmp/app.html',
    'https://example.com/path',
    'https://example.com/?token=secret',
  ]) {
    assert.throws(() => resolveAppUrl({ packaged: false, developmentUrl }))
  }
})

test('launches the consolidated chat path', () => {
  assert.equal(resolveAppUrl({ packaged: true }).pathname, '/chat')
})
