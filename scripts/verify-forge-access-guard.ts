import assert from 'node:assert/strict'
import { CAPABILITIES } from '../src/db/types'
import { FORGE_CAPABILITY, isForgeEnabled } from '../src/utils/forge-access'

assert.equal(FORGE_CAPABILITY, 'forge')
assert.equal(CAPABILITIES.includes('forge'), true)

assert.equal(isForgeEnabled(), true)
assert.equal(
  isForgeEnabled({
    enabled: undefined,
  }),
  true,
)
assert.equal(
  isForgeEnabled({
    enabled: 'false',
  }),
  false,
)
assert.equal(
  isForgeEnabled({
    enabled: 'true',
  }),
  true,
)

console.log('Forge access guard verifier passed')
