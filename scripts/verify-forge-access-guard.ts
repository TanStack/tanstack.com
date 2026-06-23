import assert from 'node:assert/strict'
import { CAPABILITIES } from '../src/db/types'
import { FORGE_CAPABILITY, isForgeEnabled } from '../src/utils/forge-access'

assert.equal(FORGE_CAPABILITY, 'forge')
assert.equal(CAPABILITIES.includes('forge'), true)

assert.equal(
  isForgeEnabled({
    nodeEnv: 'development',
  }),
  true,
)
assert.equal(
  isForgeEnabled({
    nodeEnv: 'production',
  }),
  false,
)
assert.equal(
  isForgeEnabled({
    enabled: 'false',
    nodeEnv: 'production',
  }),
  false,
)
assert.equal(
  isForgeEnabled({
    enabled: 'true',
    nodeEnv: 'production',
  }),
  true,
)

console.log('Forge access guard verifier passed')
