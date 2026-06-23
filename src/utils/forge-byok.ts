import type { ForgeBrowserProviderKey } from '~/utils/forge.functions'

export const forgeByokStorageKey = 'tanstack.forge.byok.v1'

export const forgeByokProviderOptions = [
  {
    defaultModel: 'gpt-5',
    label: 'OpenAI',
    value: 'openai',
  },
  {
    defaultModel: 'claude-sonnet-4-5',
    label: 'Anthropic',
    value: 'anthropic',
  },
] as const

export type ForgeBrowserByokProvider =
  (typeof forgeByokProviderOptions)[number]['value']

export function readForgeBrowserProviderKey():
  | ForgeBrowserProviderKey
  | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const rawValue = window.localStorage.getItem(forgeByokStorageKey)

    if (!rawValue) {
      return undefined
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    if (!isForgeBrowserProviderKey(parsedValue)) {
      window.localStorage.removeItem(forgeByokStorageKey)
      return undefined
    }

    if (Date.parse(parsedValue.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(forgeByokStorageKey)
      return undefined
    }

    return parsedValue
  } catch {
    window.localStorage.removeItem(forgeByokStorageKey)
    return undefined
  }
}

export function writeForgeBrowserProviderKey(key: ForgeBrowserProviderKey) {
  window.localStorage.setItem(forgeByokStorageKey, JSON.stringify(key))
}

export function clearForgeBrowserProviderKey() {
  window.localStorage.removeItem(forgeByokStorageKey)
}

export function getForgeByokProviderLabel(provider: ForgeBrowserByokProvider) {
  return (
    forgeByokProviderOptions.find((option) => option.value === provider)
      ?.label ?? 'Provider'
  )
}

export function getDefaultForgeByokModel(provider: ForgeBrowserByokProvider) {
  return (
    forgeByokProviderOptions.find((option) => option.value === provider)
      ?.defaultModel ?? 'gpt-5'
  )
}

export function parseForgeBrowserByokProvider(
  value: string,
): ForgeBrowserByokProvider {
  return value === 'anthropic' ? 'anthropic' : 'openai'
}

function isForgeBrowserProviderKey(
  value: unknown,
): value is ForgeBrowserProviderKey {
  if (!isRecord(value)) {
    return false
  }

  const provider = value.provider
  const model = value.model

  return (
    (provider === 'openai' || provider === 'anthropic') &&
    typeof value.expiresAt === 'string' &&
    typeof value.fingerprint === 'string' &&
    typeof value.label === 'string' &&
    (model === undefined || typeof model === 'string') &&
    typeof value.sealedAt === 'string' &&
    typeof value.sealedKey === 'string' &&
    value.version === 1
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
