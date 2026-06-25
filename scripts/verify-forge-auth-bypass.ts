import assert from 'node:assert/strict'
import {
  createForgeBypassUser,
  FORGE_AUTH_BYPASS_USER_ID,
  FORGE_CAPABILITY,
  isForgeAuthBypassEnabled,
  isForgeEnabled,
} from '../src/utils/forge-access'

const originalForgeAuthBypass = process.env.FORGE_AUTH_BYPASS
const originalForgeEnabled = process.env.FORGE_ENABLED
const originalNodeEnv = process.env.NODE_ENV

try {
  process.env.NODE_ENV = 'production'
  delete process.env.FORGE_AUTH_BYPASS
  delete process.env.FORGE_ENABLED

  assert.equal(isForgeEnabled(), true)
  assert.equal(isForgeAuthBypassEnabled(), false)

  process.env.FORGE_ENABLED = 'false'
  assert.equal(isForgeEnabled(), false)
  assert.equal(isForgeAuthBypassEnabled(), false)

  process.env.FORGE_AUTH_BYPASS = 'true'
  assert.equal(isForgeAuthBypassEnabled(), true)

  const user = createForgeBypassUser()
  assert.equal(user.userId, FORGE_AUTH_BYPASS_USER_ID)
  assert.equal(user.capabilities.includes(FORGE_CAPABILITY), true)
  assert.equal(user.capabilities.includes('admin'), false)
} finally {
  restoreEnvVar('FORGE_AUTH_BYPASS', originalForgeAuthBypass)
  restoreEnvVar('FORGE_ENABLED', originalForgeEnabled)
  restoreEnvVar('NODE_ENV', originalNodeEnv)
}

console.log('Forge auth bypass verifier passed')

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
