import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRedirect } from '@tanstack/react-router'
import { beforeLoadLibraryLanding } from '../src/routes/-library-landing-route'

function assertLandingRedirect(
  libraryId: Parameters<typeof beforeLoadLibraryLanding>[0],
  version: string,
  href: string,
  expectedHref: string,
) {
  try {
    beforeLoadLibraryLanding(libraryId, version, href)
    assert.fail(`Expected ${href} to redirect`)
  } catch (error) {
    assert.equal(isRedirect(error), true)
    assert.equal((error as Response).status, 308)
    assert.equal((error as Response).headers.get('Location'), expectedHref)
  }
}

test('latest numbered library landing pages permanently redirect to latest', () => {
  assertLandingRedirect(
    'query',
    'v5',
    '/query/v5?framework=react#overview',
    '/query/latest?framework=react#overview',
  )
  assertLandingRedirect('router', 'v1', '/router/v1', '/router/latest')
  assertLandingRedirect('ai', 'v0', '/ai/v0', '/ai/latest')
  assertLandingRedirect('table', 'v9', '/table/v9', '/table/latest')
})

test('latest aliases and historical library landing pages remain renderable', () => {
  assert.doesNotThrow(() =>
    beforeLoadLibraryLanding('query', 'latest', '/query/latest'),
  )
  assert.doesNotThrow(() =>
    beforeLoadLibraryLanding('query', 'v4', '/query/v4'),
  )
})
