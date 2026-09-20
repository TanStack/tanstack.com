import assert from 'node:assert/strict'
import test from 'node:test'
import type { Keyring, KeyringStorage } from '@tanstack/ai-client/byok'
import {
  createBuilderAiByokConnection,
  getBrowserBuilderAiByokConnection,
  getBuilderAiApiKeyStorageKey,
} from '../src/utils/builder-ai-api-key-storage.client'

class LegacyStorage {
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

class SecureStorage implements KeyringStorage {
  readonly id = 'secure-test'
  readonly label = 'Secure test storage'
  readonly persistent = true
  readonly unlockable = true
  readonly preview: Partial<Record<string, string>>
  keys: Keyring = {}
  loadCount = 0
  saveCount = 0
  saveError: Error | undefined

  constructor(preview: Partial<Record<string, string>> = {}) {
    this.preview = preview
  }

  peek() {
    return this.preview
  }

  load() {
    this.loadCount += 1
    return this.keys
  }

  save(keys: Keyring) {
    this.saveCount += 1
    if (this.saveError) throw this.saveError
    this.keys = { ...keys }
  }

  clear() {
    this.keys = {}
  }
}

function storeLegacyKeys(storage: LegacyStorage, scope: string, keys: Keyring) {
  storage.setItem(
    getBuilderAiApiKeyStorageKey(scope),
    JSON.stringify({ version: 1, keys }),
  )
}

function getNotebookAiApiKeyStorageKey(scope: string) {
  return `tanstack-notebook-ai:api-keys:v1:${encodeURIComponent(scope)}`
}

test('hydrates legacy keys into official memory storage without a passkey prompt', async () => {
  const scope = 'legacy-no-prompt'
  const legacyStorage = new LegacyStorage()
  const storage = new SecureStorage()
  storeLegacyKeys(legacyStorage, scope, { openai: 'sk-legacy' })

  const connection = createBuilderAiByokConnection({
    scope,
    storage,
    legacyStorage,
  })
  assert.equal(connection.getSnapshot().ready, false)

  await connection.ready()

  assert.equal(connection.getSnapshot().ready, true)
  assert.equal(storage.loadCount, 0)
  assert.equal(storage.saveCount, 0)
  assert.deepEqual(connection.legacy.headers('openai'), {
    'x-byok-openai': 'sk-legacy',
  })
  assert.equal(
    connection.getClient('openai', { allowUnlock: false }),
    connection.legacy,
  )
})

test('moves a legacy key only after secure storage succeeds', async () => {
  const scope = 'legacy-migration-success'
  const legacyStorage = new LegacyStorage()
  const storage = new SecureStorage()
  storeLegacyKeys(legacyStorage, scope, {
    openai: 'sk-openai',
    anthropic: 'sk-anthropic',
  })
  const connection = createBuilderAiByokConnection({
    scope,
    storage,
    legacyStorage,
  })

  await connection.migrateLegacy('openai')

  assert.equal(storage.saveCount, 1)
  assert.deepEqual(storage.keys, { openai: 'sk-openai' })
  assert.deepEqual(connection.current.headers('openai'), {
    'x-byok-openai': 'sk-openai',
  })
  assert.deepEqual(connection.legacy.headers('openai'), {})
  assert.deepEqual(
    JSON.parse(
      legacyStorage.getItem(getBuilderAiApiKeyStorageKey(scope)) ?? '',
    ),
    { version: 1, keys: { anthropic: 'sk-anthropic' } },
  )
})

test('moves old notebook keys and prefers a newer builder key', async () => {
  const scope = 'notebook-legacy-migration'
  const legacyStorage = new LegacyStorage()
  const storage = new SecureStorage()
  legacyStorage.setItem(
    getNotebookAiApiKeyStorageKey(scope),
    JSON.stringify({
      version: 1,
      keys: { openai: 'sk-notebook', anthropic: 'sk-anthropic' },
    }),
  )
  storeLegacyKeys(legacyStorage, scope, { openai: 'sk-builder' })
  const connection = createBuilderAiByokConnection({
    scope,
    storage,
    legacyStorage,
  })

  await connection.ready()
  assert.deepEqual(connection.legacy.headers('openai'), {
    'x-byok-openai': 'sk-builder',
  })

  await connection.migrateLegacy('openai')

  assert.deepEqual(storage.keys, { openai: 'sk-builder' })
  assert.equal(legacyStorage.getItem(getBuilderAiApiKeyStorageKey(scope)), null)
  assert.deepEqual(
    JSON.parse(
      legacyStorage.getItem(getNotebookAiApiKeyStorageKey(scope)) ?? '',
    ),
    { version: 1, keys: { anthropic: 'sk-anthropic' } },
  )
})

test('preserves the legacy key when secure storage fails', async () => {
  const scope = 'legacy-migration-failure'
  const legacyStorage = new LegacyStorage()
  const storage = new SecureStorage()
  storage.saveError = new Error('Passkey registration failed')
  storeLegacyKeys(legacyStorage, scope, { openai: 'sk-legacy' })
  const connection = createBuilderAiByokConnection({
    scope,
    storage,
    legacyStorage,
  })

  await assert.rejects(
    connection.migrateLegacy('openai'),
    /Passkey registration failed/,
  )

  assert.notEqual(
    legacyStorage.getItem(getBuilderAiApiKeyStorageKey(scope)),
    null,
  )
  assert.deepEqual(connection.legacy.headers('openai'), {
    'x-byok-openai': 'sk-legacy',
  })
})

test('isolates legacy and current keys by credential scope', async () => {
  const legacyStorage = new LegacyStorage()
  storeLegacyKeys(legacyStorage, 'user-one', { openai: 'sk-one' })
  storeLegacyKeys(legacyStorage, 'user-two', { openai: 'sk-two' })
  const one = createBuilderAiByokConnection({
    scope: 'user-one',
    storage: new SecureStorage(),
    legacyStorage,
  })
  const two = createBuilderAiByokConnection({
    scope: 'user-two',
    storage: new SecureStorage(),
    legacyStorage,
  })

  await Promise.all([one.ready(), two.ready()])

  assert.deepEqual(one.legacy.headers('openai'), {
    'x-byok-openai': 'sk-one',
  })
  assert.deepEqual(two.legacy.headers('openai'), {
    'x-byok-openai': 'sk-two',
  })
  await one.save('anthropic', 'sk-one-anthropic')
  assert.deepEqual(two.current.headers('anthropic'), {})
})

test('keeps fallback memory keys across browser remounts and scopes readiness', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const localStorage = new LegacyStorage()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  })

  try {
    const scope = `session-${crypto.randomUUID()}`
    const first = getBrowserBuilderAiByokConnection(scope)
    assert.equal(first.getSnapshot().ready, false)
    await first.ready()
    assert.equal(first.getSnapshot().ready, true)
    assert.equal(first.storage.persistent, false)

    await first.save('openai', 'sk-session')
    const remounted = getBrowserBuilderAiByokConnection(scope)
    const otherScope = getBrowserBuilderAiByokConnection(`${scope}-other`)

    assert.equal(remounted, first)
    assert.deepEqual(remounted.current.headers('openai'), {
      'x-byok-openai': 'sk-session',
    })
    await otherScope.ready()
    assert.deepEqual(otherScope.current.headers('openai'), {})
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
})
