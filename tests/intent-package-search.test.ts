import assert from 'node:assert/strict'
import test from 'node:test'
import { npmPackageMatchesSearch } from '../src/utils/intent.server'

const pkg = {
  name: '@apollo/client',
  description: 'A fully-featured caching GraphQL client.',
  keywords: ['apollo', 'graphql', 'react', 'tanstack-intent'],
}

test('matches package metadata without treating the registry keyword as a match', () => {
  assert.equal(npmPackageMatchesSearch(pkg, 'apollo client'), true)
  assert.equal(npmPackageMatchesSearch(pkg, 'caching graphql'), true)
  assert.equal(npmPackageMatchesSearch(pkg, 'react'), true)
  assert.equal(npmPackageMatchesSearch(pkg, 'intent'), false)
  assert.equal(npmPackageMatchesSearch(pkg, 'asdfasdfasdfasdf'), false)
})
