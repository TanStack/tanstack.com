import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptKeyring,
  deriveAesKey,
  encryptKeyring,
} from '@tanstack/ai-client/byok'

test('accepts the plain byte array returned by the 1Password PRF extension', async () => {
  const prfResult = Array.from({ length: 32 }, (_, index) => index)
  const key = await deriveAesKey(prfResult)
  const keys = { openai: 'sk-regression-test' }
  const encrypted = await encryptKeyring(key, keys)

  assert.deepEqual(
    await decryptKeyring(key, encrypted.iv, encrypted.ciphertext),
    keys,
  )
})

test('rejects malformed plain PRF arrays before importing them', async () => {
  const tooShort = Array.from({ length: 31 }, () => 0)
  const outOfRange = Array.from({ length: 32 }, (_, index) =>
    index === 31 ? 256 : 0,
  )

  await assert.rejects(
    deriveAesKey(tooShort),
    /Authenticator returned an invalid 32-byte PRF result/,
  )
  await assert.rejects(
    deriveAesKey(outOfRange),
    /Authenticator returned an invalid 32-byte PRF result/,
  )
})
