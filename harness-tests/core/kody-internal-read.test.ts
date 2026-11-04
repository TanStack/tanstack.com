import { describe, expect, it } from 'vitest'
import {
  KODY_INTERNAL_READ_PREFIX,
  kodyInternalReadArgs,
} from '../../src/chat/server/kody-internal-read'

describe('Kody internal run provenance', () => {
  it('marks separate reads without overwriting a caller operation key', () => {
    const input = { code: 'read account state' }
    const first = kodyInternalReadArgs(input)
    const second = kodyInternalReadArgs(input)
    expect(input).not.toHaveProperty('idempotencyKey')
    expect(first.idempotencyKey).toMatch(
      new RegExp(`^${KODY_INTERNAL_READ_PREFIX}[0-9a-f-]{36}$`),
    )
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
    expect(() =>
      kodyInternalReadArgs({ ...input, idempotencyKey: 'user-operation' }),
    ).toThrow('already has an idempotency key')
  })
})
