import {
  notebookAiRemoteProviders,
  type NotebookAiRemoteProvider,
} from './notebook-ai'

const notebookAiApiKeyStoragePrefix = 'tanstack-notebook-ai:api-keys:v1:'

type NotebookAiApiKeyStorage = Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
>

type StoredNotebookAiApiKeys = Partial<Record<NotebookAiRemoteProvider, string>>

export function getBrowserNotebookAiApiKeyStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function loadNotebookAiApiKey(
  storage: NotebookAiApiKeyStorage | undefined,
  scope: string,
  provider: NotebookAiRemoteProvider,
) {
  return readStoredKeys(storage, scope)?.[provider]
}

export function setNotebookAiApiKeyPersistence(
  storage: NotebookAiApiKeyStorage | undefined,
  scope: string,
  provider: NotebookAiRemoteProvider,
  apiKey: string,
  persist: boolean,
) {
  if (!persist) {
    return storage ? removeNotebookAiApiKey(storage, scope, provider) : true
  }
  if (!storage) return false

  const normalizedKey = apiKey.trim()
  if (!isValidApiKey(normalizedKey)) return false

  const keys = readStoredKeys(storage, scope) ?? {}
  try {
    storage.setItem(
      getNotebookAiApiKeyStorageKey(scope),
      JSON.stringify({
        version: 1,
        keys: { ...keys, [provider]: normalizedKey },
      }),
    )
    return true
  } catch {
    return false
  }
}

export function removeNotebookAiApiKey(
  storage: NotebookAiApiKeyStorage | undefined,
  scope: string,
  provider: NotebookAiRemoteProvider,
) {
  if (!storage) return false

  const keys = readStoredKeys(storage, scope)
  if (!keys?.[provider]) return removeStoredRecord(storage, scope)

  const retained = Object.fromEntries(
    Object.entries(keys).filter(([candidate]) => candidate !== provider),
  )

  try {
    if (Object.keys(retained).length === 0) {
      storage.removeItem(getNotebookAiApiKeyStorageKey(scope))
    } else {
      storage.setItem(
        getNotebookAiApiKeyStorageKey(scope),
        JSON.stringify({ version: 1, keys: retained }),
      )
    }
    return true
  } catch {
    return false
  }
}

export function getNotebookAiApiKeyStorageKey(scope: string) {
  return `${notebookAiApiKeyStoragePrefix}${encodeURIComponent(scope)}`
}

function readStoredKeys(
  storage: NotebookAiApiKeyStorage | undefined,
  scope: string,
) {
  if (!storage) return undefined

  try {
    const source = storage.getItem(getNotebookAiApiKeyStorageKey(scope))
    if (!source) return undefined
    return parseStoredKeys(JSON.parse(source))
  } catch {
    removeStoredRecord(storage, scope)
    return undefined
  }
}

function parseStoredKeys(value: unknown): StoredNotebookAiApiKeys {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['version', 'keys']) ||
    value.version !== 1 ||
    !isRecord(value.keys) ||
    !Object.keys(value.keys).every(isNotebookAiRemoteProvider) ||
    !Object.values(value.keys).every(isValidApiKey)
  ) {
    throw new Error('Invalid stored notebook AI API keys')
  }

  const keys: StoredNotebookAiApiKeys = {}
  for (const provider of notebookAiRemoteProviders) {
    const apiKey = value.keys[provider]
    if (typeof apiKey === 'string') keys[provider] = apiKey
  }
  return keys
}

function removeStoredRecord(storage: NotebookAiApiKeyStorage, scope: string) {
  try {
    storage.removeItem(getNotebookAiApiKeyStorageKey(scope))
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

function isNotebookAiRemoteProvider(
  value: string,
): value is NotebookAiRemoteProvider {
  return value === 'openai' || value === 'anthropic'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
