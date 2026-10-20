import { expect, it } from 'vitest'
import { availableAppBuild } from '../../src/chat/core/app-version'

it('offers a refresh for a changed build, including rollbacks, but not malformed or development responses', () => {
  const current = 'a'.repeat(64)
  const next = 'b'.repeat(64)
  expect(availableAppBuild(current, { build: next })).toBe(next)
  expect(availableAppBuild(next, { build: current })).toBe(current)
  expect(availableAppBuild(current, { build: current })).toBeUndefined()
  expect(availableAppBuild('development', { build: next })).toBeUndefined()
  for (const value of [
    null,
    {},
    { build: 'development' },
    { error: 'offline' },
    { build: 3 },
  ]) {
    expect(availableAppBuild(current, value)).toBeUndefined()
  }
})
