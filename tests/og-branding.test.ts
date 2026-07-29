import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAccentColor } from '../src/server/og/colors'

test('OG accents follow the rebrand category palette', () => {
  assert.equal(getAccentColor('start'), '#39af46')
  assert.equal(getAccentColor('query'), '#d3481b')
  assert.equal(getAccentColor('table'), '#3aa3c4')
  assert.equal(getAccentColor('virtual'), '#ffa216')
  assert.equal(getAccentColor('workflow'), '#3e3529')
})
