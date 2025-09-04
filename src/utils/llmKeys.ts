export interface LLMKey {
  id: string
  provider: 'openai' | 'anthropic'
  keyName: string
  apiKey: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'tanstack_llm_keys'

// Generate a simple ID
function generateId(): string {
  return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Format key for display (first 5 + stars + last 5)
function formatKeyForDisplay(apiKey: string): string {
  if (apiKey.length <= 10) {
    return '*'.repeat(apiKey.length)
  }

  const firstFive = apiKey.substring(0, 5)
  const lastFive = apiKey.substring(apiKey.length - 5)
  const middleStars = '*'.repeat(Math.min(20, apiKey.length - 10))

  return `${firstFive}${middleStars}${lastFive}`
}

// Get all LLM keys from localStorage
export function getLLMKeys(): LLMKey[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading LLM keys from localStorage:', error)
    return []
  }
}

// Get LLM keys with masked API keys for display
export function getLLMKeysForDisplay(): Array<
  Omit<LLMKey, 'apiKey'> & { apiKey: string }
> {
  const keys = getLLMKeys()
  return keys.map((key) => ({
    ...key,
    apiKey: formatKeyForDisplay(key.apiKey),
  }))
}

// Save LLM keys to localStorage
function saveLLMKeys(keys: LLMKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch (error) {
    console.error('Error saving LLM keys to localStorage:', error)
    throw new Error('Failed to save LLM keys')
  }
}

// Create a new LLM key
export function createLLMKey(data: {
  provider: 'openai' | 'anthropic'
  keyName: string
  apiKey: string
  isActive?: boolean
}): LLMKey {
  const keys = getLLMKeys()
  const now = Date.now()

  const newKey: LLMKey = {
    id: generateId(),
    provider: data.provider,
    keyName: data.keyName,
    apiKey: data.apiKey,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  }

  keys.push(newKey)
  saveLLMKeys(keys)

  return newKey
}

// Update an LLM key
export function updateLLMKey(
  keyId: string,
  updates: {
    provider?: 'openai' | 'anthropic'
    keyName?: string
    apiKey?: string
    isActive?: boolean
  }
): void {
  const keys = getLLMKeys()
  const keyIndex = keys.findIndex((key) => key.id === keyId)

  if (keyIndex === -1) {
    throw new Error('LLM key not found')
  }

  const key = keys[keyIndex]
  keys[keyIndex] = {
    ...key,
    ...updates,
    updatedAt: Date.now(),
  }

  saveLLMKeys(keys)
}

// Delete an LLM key
export function deleteLLMKey(keyId: string): void {
  const keys = getLLMKeys()
  const filteredKeys = keys.filter((key) => key.id !== keyId)

  if (filteredKeys.length === keys.length) {
    throw new Error('LLM key not found')
  }

  saveLLMKeys(filteredKeys)
}

// Toggle active status of an LLM key
export function toggleLLMKeyStatus(keyId: string): boolean {
  const keys = getLLMKeys()
  const keyIndex = keys.findIndex((key) => key.id === keyId)

  if (keyIndex === -1) {
    throw new Error('LLM key not found')
  }

  const newStatus = !keys[keyIndex].isActive
  keys[keyIndex] = {
    ...keys[keyIndex],
    isActive: newStatus,
    updatedAt: Date.now(),
  }

  saveLLMKeys(keys)
  return newStatus
}

// Get active keys by provider
export function getActiveKeysByProvider(
  provider: 'openai' | 'anthropic'
): LLMKey[] {
  const keys = getLLMKeys()
  return keys.filter((key) => key.provider === provider && key.isActive)
}

// Get first active key by provider
export function getActiveKeyByProvider(
  provider: 'openai' | 'anthropic'
): LLMKey | undefined {
  const keys = getActiveKeysByProvider(provider)
  return keys[0]
}

// Check if user has any active keys
export function hasActiveKeys(): boolean {
  const keys = getLLMKeys()
  return keys.some((key) => key.isActive)
}
