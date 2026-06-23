import assert from 'node:assert/strict'

const originalByokSealingKey = process.env.FORGE_BYOK_SEALING_KEY
const originalNodeEnv = process.env.NODE_ENV
const originalRequireByok = process.env.FORGE_REQUIRE_BYOK

process.env.FORGE_BYOK_SEALING_KEY = 'forge-byok-test-sealing-key'

try {
  const {
    forgeRequiresByokForRuns,
    sealForgeProviderKey,
    unsealForgeProviderKey,
  } = await import('../src/builder/runtime/forge-byok.server')

  const sealed = sealForgeProviderKey({
    apiKey: 'sk-test-123456789012345678901234',
    model: 'gpt-5',
    provider: 'openai',
    userId: 'user-1',
  })

  assert.equal(sealed.provider, 'openai')
  assert.equal(sealed.model, 'gpt-5')
  assert.equal(sealed.version, 1)
  assert.ok(sealed.fingerprint.length > 0)
  assert.ok(sealed.sealedKey.startsWith('forge_byok_v1.'))
  assert.equal(sealed.sealedKey.includes('sk-test'), false)

  assert.deepEqual(
    unsealForgeProviderKey({
      provider: 'openai',
      sealedKey: sealed.sealedKey,
      userId: 'user-1',
    }),
    {
      apiKey: 'sk-test-123456789012345678901234',
      model: 'gpt-5',
      provider: 'openai',
    },
  )

  assert.throws(() =>
    unsealForgeProviderKey({
      provider: 'openai',
      sealedKey: sealed.sealedKey,
      userId: 'user-2',
    }),
  )

  assert.throws(() =>
    unsealForgeProviderKey({
      provider: 'anthropic',
      sealedKey: sealed.sealedKey,
      userId: 'user-1',
    }),
  )

  delete process.env.FORGE_REQUIRE_BYOK
  process.env.NODE_ENV = 'development'
  assert.equal(forgeRequiresByokForRuns(), false)

  process.env.FORGE_REQUIRE_BYOK = 'true'
  assert.equal(forgeRequiresByokForRuns(), true)

  delete process.env.FORGE_REQUIRE_BYOK
  process.env.NODE_ENV = 'production'
  assert.equal(forgeRequiresByokForRuns(), true)
} finally {
  restoreEnvVar('FORGE_BYOK_SEALING_KEY', originalByokSealingKey)
  restoreEnvVar('NODE_ENV', originalNodeEnv)
  restoreEnvVar('FORGE_REQUIRE_BYOK', originalRequireByok)
}

console.log('Forge BYOK sealing verifier passed')

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
