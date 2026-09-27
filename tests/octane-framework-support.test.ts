import assert from 'node:assert/strict'
import { ai, charts, libraries, store, table } from '../src/libraries/libraries'
import { getFrameworkPackageName } from '../src/libraries/frameworkSupport'

assert.deepEqual(
  libraries
    .filter((library) => library.frameworks.includes('octane'))
    .map((library) => library.id),
  ['table', 'charts', 'ai', 'store'],
  'Table, Charts, AI, and Store advertise Octane support',
)

assert.equal(
  getFrameworkPackageName('octane', table.id, table),
  '@tanstack/octane-table',
)

assert.equal(
  getFrameworkPackageName('octane', charts.id, charts),
  '@tanstack/charts',
)

assert.equal(
  getFrameworkPackageName('octane', ai.id, ai),
  '@tanstack/ai-octane',
)

assert.equal(
  getFrameworkPackageName('octane', store.id, store),
  '@tanstack/octane-store',
)

console.log('Octane framework support tests passed')
