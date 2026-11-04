import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { DOCS_WIDTH_BOOTSTRAP } from '../src/utils/docs-width'

function applyPreference(value: string | null, blocked = false) {
  const properties = new Map<string, string>()
  runInNewContext(DOCS_WIDTH_BOOTSTRAP, {
    localStorage: {
      getItem(key: string) {
        assert.equal(key, 'docsFullWidth')
        if (blocked) throw new Error('Storage is unavailable')
        return value
      },
    },
    document: {
      documentElement: {
        style: {
          setProperty(key: string, value: string) {
            properties.set(key, value)
          },
        },
      },
    },
    Date: { now: () => 1000 },
  })
  return properties.get('--docs-content-width')
}

test('saved expanded width applies before React mounts', () => {
  assert.equal(applyPreference('{"value":true,"ttl":null}'), '100%')
  assert.equal(applyPreference('{"value":true}'), '100%')
  assert.equal(applyPreference('{"value":true,"ttl":1000}'), '100%')
  assert.equal(applyPreference('{"value":true,"ttl":2000}'), '100%')
})

test('constrained, missing, expired and invalid preferences retain the default width', () => {
  for (const value of [
    null,
    'null',
    '{}',
    'invalid json',
    '{"value":false}',
    '{"value":"true"}',
    '{"value":true,"ttl":999}',
  ]) {
    assert.equal(applyPreference(value), undefined)
  }
})

test('blocked storage does not interrupt document initialization', () => {
  assert.equal(applyPreference(null, true), undefined)
})
