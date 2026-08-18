import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getBrowserNotebookAiApiKeyStorage,
  getNotebookAiApiKeyStorageKey,
  loadNotebookAiApiKey,
  removeNotebookAiApiKey,
  setNotebookAiApiKeyPersistence,
} from '../src/utils/notebook-ai-api-key-storage.client'

const scope = 'user-1'
const storageKey = getNotebookAiApiKeyStorageKey(scope)

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

test('persists API keys only with explicit opt-in', () => {
  const storage = new MemoryStorage()

  assert.equal(
    setNotebookAiApiKeyPersistence(
      storage,
      scope,
      'openai',
      'sk-memory-only',
      false,
    ),
    true,
  )
  assert.equal(storage.getItem(storageKey), null)

  assert.equal(
    setNotebookAiApiKeyPersistence(
      storage,
      scope,
      'openai',
      '  sk-stored  ',
      true,
    ),
    true,
  )
  assert.equal(loadNotebookAiApiKey(storage, scope, 'openai'), 'sk-stored')
  assert.deepEqual(JSON.parse(storage.getItem(storageKey)!), {
    version: 1,
    keys: { openai: 'sk-stored' },
  })
})

test('loads and removes keys per provider', () => {
  const storage = new MemoryStorage()

  setNotebookAiApiKeyPersistence(storage, scope, 'openai', 'sk-openai', true)
  setNotebookAiApiKeyPersistence(
    storage,
    scope,
    'anthropic',
    'sk-anthropic',
    true,
  )

  assert.equal(loadNotebookAiApiKey(storage, scope, 'openai'), 'sk-openai')
  assert.equal(
    loadNotebookAiApiKey(storage, scope, 'anthropic'),
    'sk-anthropic',
  )
  assert.equal(removeNotebookAiApiKey(storage, scope, 'openai'), true)
  assert.equal(loadNotebookAiApiKey(storage, scope, 'openai'), undefined)
  assert.equal(
    loadNotebookAiApiKey(storage, scope, 'anthropic'),
    'sk-anthropic',
  )
  assert.equal(
    setNotebookAiApiKeyPersistence(
      storage,
      scope,
      'anthropic',
      'ignored',
      false,
    ),
    true,
  )
  assert.equal(storage.getItem(storageKey), null)
})

test('isolates persisted API keys by credential scope', () => {
  const storage = new MemoryStorage()

  setNotebookAiApiKeyPersistence(storage, 'user-1', 'openai', 'sk-one', true)
  setNotebookAiApiKeyPersistence(storage, 'user-2', 'openai', 'sk-two', true)

  assert.equal(loadNotebookAiApiKey(storage, 'user-1', 'openai'), 'sk-one')
  assert.equal(loadNotebookAiApiKey(storage, 'user-2', 'openai'), 'sk-two')
})

test('rejects and clears malformed or unsupported records', async (t) => {
  const invalidRecords = [
    '{',
    JSON.stringify({ version: 2, keys: { openai: 'sk-key' } }),
    JSON.stringify({ version: 1, keys: { openai: ' sk-key' } }),
    JSON.stringify({ version: 1, keys: { openai: '' } }),
    JSON.stringify({ version: 1, keys: { google: 'sk-key' } }),
    JSON.stringify({ version: 1, keys: { openai: 'sk-key' }, extra: true }),
  ]

  for (const source of invalidRecords) {
    await t.test(source, () => {
      const storage = new MemoryStorage()
      storage.setItem(storageKey, source)

      assert.equal(loadNotebookAiApiKey(storage, scope, 'openai'), undefined)
      assert.equal(storage.getItem(storageKey), null)
    })
  }

  const storage = new MemoryStorage()
  assert.equal(
    setNotebookAiApiKeyPersistence(
      storage,
      scope,
      'openai',
      'x'.repeat(4_097),
      true,
    ),
    false,
  )
  assert.equal(storage.getItem(storageKey), null)
})

test('contains unavailable storage failures', () => {
  const storage = {
    getItem() {
      throw new Error('Storage unavailable')
    },
    removeItem() {
      throw new Error('Storage unavailable')
    },
    setItem() {
      throw new Error('Storage unavailable')
    },
  }

  assert.equal(loadNotebookAiApiKey(storage, scope, 'openai'), undefined)
  assert.equal(
    setNotebookAiApiKeyPersistence(storage, scope, 'openai', 'sk-key', true),
    false,
  )
  assert.equal(
    setNotebookAiApiKeyPersistence(storage, scope, 'openai', 'sk-key', false),
    false,
  )
  assert.equal(removeNotebookAiApiKey(storage, scope, 'openai'), false)
  assert.equal(loadNotebookAiApiKey(undefined, scope, 'openai'), undefined)
  assert.equal(
    setNotebookAiApiKeyPersistence(undefined, scope, 'openai', 'sk-key', false),
    true,
  )
  assert.equal(
    setNotebookAiApiKeyPersistence(undefined, scope, 'openai', 'sk-key', true),
    false,
  )
  assert.equal(removeNotebookAiApiKey(undefined, scope, 'openai'), false)
  assert.equal(getBrowserNotebookAiApiKeyStorage(), undefined)
})
