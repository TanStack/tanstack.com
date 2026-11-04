import { afterEach, describe, expect, it, vi } from 'vitest'
const runtime = vi.hoisted(() => ({ env: vi.fn() }))
vi.mock('~/server/runtime/host.server', () => ({
  getHostRuntimeEnv: runtime.env,
}))
import { getKodyEnvironment } from '../../src/chat/server/kody-environment.server'
afterEach(() => vi.unstubAllEnvs())
describe('optional Kody environment', () => {
  it('preserves credential storage without a Kody origin', async () => {
    vi.stubEnv('KODY_ORIGIN', '')
    runtime.env.mockResolvedValue({ ENCRYPTION_KEY: 'a'.repeat(32) })
    expect(await getKodyEnvironment()).toEqual({
      KODY_ORIGIN: '',
      ENCRYPTION_KEY: 'a'.repeat(32),
    })
  })
  it('allows private skill reads without optional integration configuration', async () => {
    vi.stubEnv('KODY_ORIGIN', '')
    vi.stubEnv('ENCRYPTION_KEY', '')
    runtime.env.mockResolvedValue({})
    expect(await getKodyEnvironment()).toEqual({
      KODY_ORIGIN: '',
      ENCRYPTION_KEY: '',
    })
  })
  it('rejects configured Kody without encrypted account storage', async () => {
    vi.stubEnv('ENCRYPTION_KEY', '')
    runtime.env.mockResolvedValue({ KODY_ORIGIN: 'https://kody.codes' })
    await expect(getKodyEnvironment()).rejects.toThrow(
      'storage is not configured',
    )
  })
})
