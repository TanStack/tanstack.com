import assert from 'node:assert/strict'
import { allMaintainers } from '../src/libraries/maintainers'
import {
  findLibrary,
  isPublicLibrary,
  libraries,
  publicLibraries,
} from '../src/libraries/libraries'

assert.deepEqual(
  publicLibraries,
  libraries.filter(isPublicLibrary),
  'publicLibraries stays in sync with the public-library selector',
)

assert.equal(
  publicLibraries.some((library) => library.id === 'ranger'),
  false,
  'Ranger stays delisted from public library discovery',
)
assert.equal(
  findLibrary('ranger')?.to,
  '/ranger',
  'Ranger keeps its permalink while delisted',
)

for (const library of publicLibraries) {
  assert.equal(
    library.to.startsWith('/'),
    true,
    `${library.id} public route must be an internal absolute path`,
  )
  assert.notEqual(
    library.visible,
    false,
    `${library.id} hidden library should not be public`,
  )
}

for (const maintainer of allMaintainers) {
  const socialEntries = Object.entries(maintainer.social ?? {})

  for (const [field, value] of socialEntries) {
    assert.match(
      value,
      /^https:\/\//,
      `${maintainer.github} ${field} URL must use an explicit https:// URL`,
    )
  }
}

console.log('static data contract tests passed')
