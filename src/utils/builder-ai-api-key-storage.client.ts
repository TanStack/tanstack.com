import {
  defaultByokStorage,
  defineByok,
  memoryStorage,
  type ByokClient,
  type KeyringStorage,
} from '@tanstack/ai-client/byok'
import {
  builderAiRemoteProviders,
  type BuilderAiRemoteProvider,
} from './builder-ai'

const builderAiApiKeyStoragePrefix = 'tanstack-builder-ai:api-keys:v1:'
const notebookAiApiKeyStoragePrefix = 'tanstack-notebook-ai:api-keys:v1:'
const builderAiByokDatabasePrefix = 'tanstack-builder-ai:byok:v1:'
const anonymousCredentialScope = 'anonymous'

type BuilderAiApiKeyStorage = Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
>

type StoredBuilderAiApiKeys = Partial<Record<BuilderAiRemoteProvider, string>>

export type BuilderAiByokConnectionSnapshot = {
  ready: boolean
}

export type BuilderAiByokConnection = {
  current: ByokClient
  legacy: ByokClient
  storage: KeyringStorage
  getSnapshot: () => BuilderAiByokConnectionSnapshot
  subscribe: (listener: () => void) => () => void
  ready: () => Promise<void>
  getClient: (
    provider: BuilderAiRemoteProvider,
    options: { allowUnlock: boolean },
  ) => ByokClient | undefined
  hasCurrentKey: (provider: BuilderAiRemoteProvider) => boolean
  hasConfiguredKey: (provider: BuilderAiRemoteProvider) => boolean
  hasLegacyKey: (provider: BuilderAiRemoteProvider) => boolean
  save: (provider: BuilderAiRemoteProvider, apiKey: string) => Promise<void>
  migrateLegacy: (provider: BuilderAiRemoteProvider) => Promise<void>
  unlock: (provider: BuilderAiRemoteProvider) => Promise<void>
  clear: (provider: BuilderAiRemoteProvider) => Promise<void>
}

type CreateBuilderAiByokConnectionOptions = {
  scope: string
  storage: KeyringStorage
  legacyStorage?: BuilderAiApiKeyStorage
}

const browserConnections = new Map<string, BuilderAiByokConnection>()

export function getBrowserBuilderAiByokConnection(
  credentialScope: string | undefined,
) {
  const scope = credentialScope ?? anonymousCredentialScope
  if (typeof window === 'undefined') {
    return createBuilderAiByokConnection({
      scope,
      storage: memoryStorage(),
    })
  }

  const cached = browserConnections.get(scope)
  if (cached) return cached

  const connection = createBuilderAiByokConnection({
    scope,
    storage: defaultByokStorage({
      dbName: `${builderAiByokDatabasePrefix}${encodeURIComponent(scope)}`,
      rpName: 'TanStack Builder',
      userName: 'TanStack Builder',
    }),
    legacyStorage: getBrowserBuilderAiApiKeyStorage(),
  })
  browserConnections.set(scope, connection)
  return connection
}

export function createBuilderAiByokConnection({
  scope,
  storage,
  legacyStorage,
}: CreateBuilderAiByokConnectionOptions): BuilderAiByokConnection {
  const current = defineByok({ storage })
  const legacy = defineByok({ storage: memoryStorage() })
  const listeners = new Set<() => void>()
  let snapshot: BuilderAiByokConnectionSnapshot = { ready: false }

  const ready = Promise.all([current.ready(), legacy.ready()]).then(
    async () => {
      const legacyKeys = readLegacyStoredKeys(legacyStorage, scope)
      if (Object.keys(legacyKeys).length > 0) {
        for (const provider of builderAiRemoteProviders) {
          const apiKey = legacyKeys[provider]
          if (apiKey) await legacy.update(provider, apiKey)
        }
      }
      snapshot = { ready: true }
      for (const listener of listeners) listener()
    },
  )

  function hasUnlockedCurrentKey(provider: BuilderAiRemoteProvider) {
    return Boolean(current.keys()[provider])
  }

  function hasLegacyKey(provider: BuilderAiRemoteProvider) {
    return Boolean(legacy.keys()[provider])
  }

  function hasLockedKey(provider: BuilderAiRemoteProvider) {
    return current.getSnapshot().status[provider]?.state === 'locked'
  }

  function hasCurrentEntry(provider: BuilderAiRemoteProvider) {
    return Boolean(current.getSnapshot().status[provider])
  }

  async function removeLegacyKey(provider: BuilderAiRemoteProvider) {
    if (!hasLegacyKey(provider)) return
    if (!removeBuilderAiLegacyApiKey(legacyStorage, scope, provider)) {
      throw new Error(
        'The key is connected, but the older browser copy could not be removed.',
      )
    }
    await legacy.clear(provider)
  }

  return {
    current,
    legacy,
    storage,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ready: () => ready,
    getClient(provider, { allowUnlock }) {
      if (hasUnlockedCurrentKey(provider)) return current
      if (allowUnlock && hasLockedKey(provider)) return current
      if (hasLegacyKey(provider)) return legacy
      return undefined
    },
    hasCurrentKey(provider) {
      return hasUnlockedCurrentKey(provider) || hasLockedKey(provider)
    },
    hasConfiguredKey(provider) {
      return (
        hasUnlockedCurrentKey(provider) ||
        hasLockedKey(provider) ||
        hasLegacyKey(provider)
      )
    },
    hasLegacyKey,
    async save(provider, apiKey) {
      await ready
      await current.update(provider, apiKey)
      await removeLegacyKey(provider)
    },
    async migrateLegacy(provider) {
      await ready
      if (hasUnlockedCurrentKey(provider) || hasLockedKey(provider)) {
        await removeLegacyKey(provider)
        return
      }
      if (!storage.persistent) {
        throw new Error('Passkey storage is unavailable in this browser.')
      }
      const apiKey = legacy.keys()[provider]
      if (!apiKey) throw new Error('The older saved key is unavailable.')

      await current.update(provider, apiKey)
      await removeLegacyKey(provider)
    },
    async unlock(provider) {
      await ready
      if (current.getSnapshot().status[provider]?.state !== 'locked') return
      current.request(provider, 'locked')
      await current.unlock()
    },
    async clear(provider) {
      await ready
      if (hasCurrentEntry(provider)) await current.clear(provider)
      if (!removeBuilderAiLegacyApiKey(legacyStorage, scope, provider)) {
        throw new Error('The older browser copy could not be removed.')
      }
      await legacy.clear(provider)
    },
  }
}

export function getBrowserBuilderAiApiKeyStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function getBuilderAiApiKeyStorageKey(scope: string) {
  return `${builderAiApiKeyStoragePrefix}${encodeURIComponent(scope)}`
}

function readStoredKeys(
  storage: BuilderAiApiKeyStorage | undefined,
  storageKey: string,
) {
  if (!storage) return undefined

  try {
    const source = storage.getItem(storageKey)
    if (!source) return undefined
    return parseStoredKeys(JSON.parse(source))
  } catch {
    removeStoredRecord(storage, storageKey)
    return undefined
  }
}

function readLegacyStoredKeys(
  storage: BuilderAiApiKeyStorage | undefined,
  scope: string,
) {
  const keys: StoredBuilderAiApiKeys = {}
  for (const storageKey of getBuilderAiLegacyApiKeyStorageKeys(scope)) {
    Object.assign(keys, readStoredKeys(storage, storageKey))
  }
  return keys
}

function parseStoredKeys(value: unknown): StoredBuilderAiApiKeys {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['version', 'keys']) ||
    value.version !== 1 ||
    !isRecord(value.keys) ||
    !Object.keys(value.keys).every(isBuilderAiRemoteProvider) ||
    !Object.values(value.keys).every(isValidApiKey)
  ) {
    throw new Error('Invalid stored builder AI API keys')
  }

  const keys: StoredBuilderAiApiKeys = {}
  for (const provider of builderAiRemoteProviders) {
    const apiKey = value.keys[provider]
    if (typeof apiKey === 'string') keys[provider] = apiKey
  }
  return keys
}

function removeBuilderAiLegacyApiKey(
  storage: BuilderAiApiKeyStorage | undefined,
  scope: string,
  provider: BuilderAiRemoteProvider,
) {
  if (!storage) return true

  let removed = true
  for (const storageKey of getBuilderAiLegacyApiKeyStorageKeys(scope)) {
    if (!removeLegacyApiKeyFromRecord(storage, storageKey, provider)) {
      removed = false
    }
  }
  return removed
}

function removeLegacyApiKeyFromRecord(
  storage: BuilderAiApiKeyStorage,
  storageKey: string,
  provider: BuilderAiRemoteProvider,
) {
  const keys = readStoredKeys(storage, storageKey)
  if (!keys?.[provider]) return true

  const retained: StoredBuilderAiApiKeys = {}
  for (const candidate of builderAiRemoteProviders) {
    if (candidate !== provider && keys[candidate]) {
      retained[candidate] = keys[candidate]
    }
  }

  try {
    if (Object.keys(retained).length === 0) {
      storage.removeItem(storageKey)
    } else {
      storage.setItem(
        storageKey,
        JSON.stringify({ version: 1, keys: retained }),
      )
    }
    return true
  } catch {
    return false
  }
}

function getBuilderAiLegacyApiKeyStorageKeys(scope: string) {
  const encodedScope = encodeURIComponent(scope)
  return [
    `${notebookAiApiKeyStoragePrefix}${encodedScope}`,
    getBuilderAiApiKeyStorageKey(scope),
  ]
}

function removeStoredRecord(
  storage: BuilderAiApiKeyStorage,
  storageKey: string,
) {
  try {
    storage.removeItem(storageKey)
    return true
  } catch {
    return false
  }
}

function isValidApiKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4_096 &&
    value.trim() === value
  )
}

function isBuilderAiRemoteProvider(
  value: string,
): value is BuilderAiRemoteProvider {
  return value === 'openai' || value === 'anthropic'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
