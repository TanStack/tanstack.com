import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('../../src/chat/server/credentials', () => ({
  updateCredentials: m.update,
}))
import { saveProviderConnection } from '../../src/chat/server/provider-connection'
import { defaultPolicy, connectionSchema } from '../../src/chat/core/types'
import type { Credentials } from '../../src/chat/core/types'
const env = { ENCRYPTION_KEY: 'test', INCLUDED_MODEL: 'included-model' }
beforeEach(() => vi.resetAllMocks())
it('preserves a saved provider key when changing its model without a new key', async () => {
  const prior: Credentials = {
    connection: connectionSchema.parse({
      provider: 'openai',
      model: 'old',
      apiKey: 'saved-key',
    }),
    connections: {},
  }
  m.update.mockImplementation(
    async (
      _env,
      _user,
      update: (current: Credentials | null) => Credentials,
    ) => {
      const next = update(prior)
      expect(next.connection.apiKey).toBe('saved-key')
      expect(next.connection.model).toBe('new')
      return next
    },
  )
  expect(
    await saveProviderConnection(env, 'owner', defaultPolicy, {
      provider: 'openai',
      model: 'new',
    }),
  ).toEqual({ ok: true })
})
it('removes provider secrets and uses the configured model for included access', async () => {
  m.update.mockImplementation(
    async (
      _env,
      _user,
      update: (current: Credentials | null) => Credentials,
    ) => {
      const next = update(null)
      expect(next.connection.apiKey).toBeUndefined()
      expect(next.connection.model).toBe('included-model')
      return next
    },
  )
  await saveProviderConnection(env, 'owner', defaultPolicy, {
    provider: 'included',
    model: 'caller-model',
    apiKey: 'ignored',
  })
})
it('rejects a restricted provider before updating encrypted storage', async () => {
  await expect(
    saveProviderConnection(
      env,
      'owner',
      { ...defaultPolicy, allowedProviders: ['included'] },
      { provider: 'openai', model: 'new' },
    ),
  ).rejects.toThrow('restricted')
  expect(m.update).not.toHaveBeenCalled()
})
