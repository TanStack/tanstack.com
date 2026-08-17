import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldAutoRunNotebook } from '../src/utils/notebook-auto-run.client'

const cases = [
  ['desktop Chrome', 'Win32', 0, 'Mozilla/5.0 Chrome/140.0', true],
  ['touch Windows', 'Win32', 10, 'Mozilla/5.0 Chrome/140.0', true],
  ['desktop Safari', 'MacIntel', 0, 'Mozilla/5.0 Macintosh Safari/18.0', true],
  ['Android', 'Linux armv8l', 5, 'Mozilla/5.0 Android 16; Mobile', true],
  ['iPhone', 'iPhone', 5, 'Mozilla/5.0 iPhone; Mobile', false],
  ['iPad', 'iPad', 5, 'Mozilla/5.0 iPad; Mobile', false],
  ['iPod', 'iPod', 5, 'Mozilla/5.0 iPod; Mobile', false],
  [
    'iPadOS desktop mode',
    'MacIntel',
    5,
    'Mozilla/5.0 Macintosh Safari/18.0',
    false,
  ],
] as const

for (const [label, platform, maxTouchPoints, userAgent, expected] of cases) {
  test(`notebook auto-run policy handles ${label}`, () => {
    assert.equal(
      shouldAutoRunNotebook({ maxTouchPoints, platform, userAgent }),
      expected,
    )
  })
}
