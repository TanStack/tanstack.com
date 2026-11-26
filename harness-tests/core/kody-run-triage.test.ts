import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeKodyRunTriage } from '../../src/chat/server/kody-run-triage'
import {
  kodyReferenceAccount,
  assertKodyReferenceAccountUnchanged,
} from '../../src/chat/server/kody-reference-access'
import { defaultPolicy } from '../../src/chat/core/types'

vi.mock('../../src/chat/server/kody-reference-access', () => ({
  kodyReferenceAccount: vi.fn(),
  assertKodyReferenceAccountUnchanged: vi.fn(),
}))
const id = '2117ab5c-72df-49b8-b685-043409559c2c'
const scope = { userId: 'u', workspaceId: 'w' }
const options = { policy: defaultPolicy, fixture: false }
const reply = (runId = id) => ({
  structuredContent: {
    result: { id: runId, status: 'error', triage: 'resolved' },
  },
})
describe('Kody error triage authorization and receipts', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(kodyReferenceAccount).mockResolvedValue({
      enabled: true,
      policyText: '{}',
      subject: 'a',
      fingerprint: 'a',
    })
  })
  it('blocks writes without a connected and permitted account', async () => {
    vi.mocked(kodyReferenceAccount).mockResolvedValue({
      enabled: false,
      reason: 'blocked',
      policyText: '{}',
      subject: 'a',
    })
    const call = vi.fn()
    await expect(
      changeKodyRunTriage(
        { KODY_ORIGIN: 'https://kody.codes', ENCRYPTION_KEY: 'test-key' },
        scope,
        options,
        id,
        { triage: 'resolved' },
        AbortSignal.timeout(1000),
        call,
      ),
    ).rejects.toThrow('unavailable')
    expect(call).not.toHaveBeenCalled()
  })
  it('checks access before writing and before accepting the receipt', async () => {
    const call = vi.fn().mockResolvedValue(reply())
    await expect(
      changeKodyRunTriage(
        { KODY_ORIGIN: 'https://kody.codes', ENCRYPTION_KEY: 'test-key' },
        scope,
        options,
        id,
        { triage: 'resolved' },
        AbortSignal.timeout(1000),
        call,
      ),
    ).resolves.toMatchObject({ id, triage: 'resolved' })
    expect(assertKodyReferenceAccountUnchanged).toHaveBeenCalledTimes(2)
    vi.mocked(assertKodyReferenceAccountUnchanged).mockRejectedValueOnce(
      new Error('Access changed'),
    )
    call.mockClear()
    await expect(
      changeKodyRunTriage(
        { KODY_ORIGIN: 'https://kody.codes', ENCRYPTION_KEY: 'test-key' },
        scope,
        options,
        id,
        { triage: 'resolved' },
        AbortSignal.timeout(1000),
        call,
      ),
    ).rejects.toThrow('Access changed')
    expect(call).not.toHaveBeenCalled()
  })
  it('does not confirm a different run or an upstream tool failure', async () => {
    for (const result of [
      reply('2117ab5c-72df-49b8-b685-043409559c2d'),
      { ...reply(), isError: true },
    ]) {
      await expect(
        changeKodyRunTriage(
          { KODY_ORIGIN: 'https://kody.codes', ENCRYPTION_KEY: 'test-key' },
          scope,
          options,
          id,
          { triage: 'resolved' },
          AbortSignal.timeout(1000),
          vi.fn().mockResolvedValue(result),
        ),
      ).rejects.toThrow('could not be confirmed')
    }
  })
})
