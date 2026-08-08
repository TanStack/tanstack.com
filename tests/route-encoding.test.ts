import assert from 'node:assert/strict'
import {
  decodePackageNameSlug,
  encodePackageNameSlug,
  getRowFieldId,
} from '../src/utils/route-encoding'

const packageNames = [
  '@tanstack/react-query',
  'tanstack__intent',
  '@scope/name_with_underscores',
  'plain-package',
]

for (const packageName of packageNames) {
  assert.equal(
    decodePackageNameSlug(encodePackageNameSlug(packageName)),
    packageName,
    `${packageName} package route slug round-trips`,
  )
}

assert.equal(
  decodePackageNameSlug(
    encodeURIComponent(encodePackageNameSlug('@scope/pkg')),
  ),
  '@scope/pkg',
  'double-encoded package route slugs decode for router/browser compatibility',
)

// Legacy `__` scope-separator slugs (still indexed by search engines) must
// resolve to the real scoped name instead of failing package-name validation.
assert.equal(
  decodePackageNameSlug('@firfi__quint-connect'),
  '@firfi/quint-connect',
  'legacy __ scoped slug decodes to the scoped package name',
)

assert.equal(
  decodePackageNameSlug('%40apollo__client'),
  '@apollo/client',
  'legacy __ scoped slug decodes from the percent-encoded form',
)

// Only the scope separator is restored; a `__` inside the package name stays.
assert.equal(
  decodePackageNameSlug('@depup__trpc__server'),
  '@depup/trpc__server',
  'only the leading scope-separator __ is restored',
)

// Unscoped names that contain `__` are not legacy scoped slugs.
assert.equal(
  decodePackageNameSlug('tanstack__intent'),
  'tanstack__intent',
  'unscoped __ names are left intact',
)

assert.equal(
  getRowFieldId('moderation-note', '@scope/pkg', 'note'),
  'moderation-note-scope-pkg-note',
  'row-local ids normalize unsafe id characters',
)

assert.equal(
  getRowFieldId('moderation-note', '', 'note'),
  'moderation-note-item-note',
  'row-local ids use stable fallback segments',
)

console.log('route-encoding tests passed')
