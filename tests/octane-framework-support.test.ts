import assert from 'node:assert/strict'
import { libraries, store, table } from '../src/libraries/libraries'
import { getFrameworkPackageName } from '../src/libraries/frameworkSupport'

assert.deepEqual(
  libraries
    .filter((library) => library.frameworks.includes('octane'))
    .map((library) => library.id),
  ['table', 'store'],
  'only Table and Store advertise Octane support',
)

assert.equal(
  getFrameworkPackageName('octane', table.id, table),
  '@tanstack/octane-table',
)

assert.equal(
  getFrameworkPackageName('octane', store.id, store),
  '@tanstack/octane-store',
)

console.log('Octane framework support tests passed')
