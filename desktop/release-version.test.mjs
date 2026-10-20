import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNewerRelease } from '../scripts/chat/desktop-release-version.mjs'

test('a fresh feed permits a valid first release', () => {
  assert.doesNotThrow(() => assertNewerRelease('0.1.3', null))
  assert.throws(
    () => assertNewerRelease('invalid', null),
    /Invalid release version/,
  )
})
test('existing feeds only permit increasing semantic versions', () => {
  for (const [next, current] of [
    ['1.0.0', '0.99.99'],
    ['1.2.0', '1.1.99'],
    ['1.2.4', '1.2.3'],
  ]) {
    assert.doesNotThrow(() => assertNewerRelease(next, current))
  }
  for (const [next, current] of [
    ['1.2.3', '1.2.3'],
    ['1.2.2', '1.2.3'],
    ['0.99.99', '1.0.0'],
  ]) {
    assert.throws(
      () => assertNewerRelease(next, current),
      /Release version must increase/,
    )
  }
})
test('malformed existing feeds cannot be treated as fresh', () => {
  for (const current of [undefined, '', 'latest', '1.2.3-beta']) {
    assert.throws(
      () => assertNewerRelease('1.2.3', current),
      /Invalid release version/,
    )
  }
})
