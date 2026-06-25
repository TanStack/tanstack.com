import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'

const FORGE_BYOK_ALGORITHM = 'aes-256-gcm'
const FORGE_BYOK_AUTH_TAG_LENGTH = 16
const FORGE_BYOK_IV_LENGTH = 12
const FORGE_BYOK_SEAL_PREFIX = 'forge_byok_v1.'
const FORGE_BYOK_SEAL_VERSION = 1
const FORGE_BYOK_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const forgeByokProviders = ['openai', 'anthropic'] as const

export type ForgeByokProvider = (typeof forgeByokProviders)[number]

export type ForgeProviderCredential = {
  apiKey: string
  model?: string
  provider: ForgeByokProvider
}

export type ForgeSealedProviderKey = {
  expiresAt: string
  fingerprint: string
  label: string
  model?: string
  provider: ForgeByokProvider
  sealedAt: string
  sealedKey: string
  version: typeof FORGE_BYOK_SEAL_VERSION
}

type ForgeByokSealPayload = ForgeProviderCredential & {
  expiresAt: string
  issuedAt: string
  userId: string
  version: typeof FORGE_BYOK_SEAL_VERSION
}

export function sealForgeProviderKey({
  apiKey,
  model,
  provider,
  userId,
}: ForgeProviderCredential & {
  userId: string
}): ForgeSealedProviderKey {
  const normalizedApiKey = normalizeForgeProviderApiKey(apiKey)
  const normalizedModel = normalizeForgeProviderModel(model)
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + FORGE_BYOK_TTL_MS)
  const payload: ForgeByokSealPayload = {
    apiKey: normalizedApiKey,
    expiresAt: expiresAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    model: normalizedModel,
    provider,
    userId,
    version: FORGE_BYOK_SEAL_VERSION,
  }
  const iv = randomBytes(FORGE_BYOK_IV_LENGTH)
  const cipher = createCipheriv(FORGE_BYOK_ALGORITHM, getForgeByokKey(), iv)
  cipher.setAAD(createForgeByokAdditionalData({ provider, userId }))
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const sealedKey = `${FORGE_BYOK_SEAL_PREFIX}${Buffer.concat([
    Buffer.from([FORGE_BYOK_SEAL_VERSION]),
    iv,
    authTag,
    encrypted,
  ]).toString('base64url')}`

  return {
    expiresAt: payload.expiresAt,
    fingerprint: fingerprintForgeProviderKey({
      apiKey: normalizedApiKey,
      provider,
    }),
    label: labelForgeProviderKey({ apiKey: normalizedApiKey, provider }),
    model: normalizedModel,
    provider,
    sealedAt: payload.issuedAt,
    sealedKey,
    version: FORGE_BYOK_SEAL_VERSION,
  }
}

export function unsealForgeProviderKey({
  provider,
  sealedKey,
  userId,
}: {
  provider: ForgeByokProvider
  sealedKey: string
  userId: string
}): ForgeProviderCredential {
  if (!sealedKey.startsWith(FORGE_BYOK_SEAL_PREFIX)) {
    throw new Error('Forge provider key is not sealed.')
  }

  const data = Buffer.from(
    sealedKey.slice(FORGE_BYOK_SEAL_PREFIX.length),
    'base64url',
  )
  const version = data[0]

  if (version !== FORGE_BYOK_SEAL_VERSION) {
    throw new Error('Forge provider key uses an unsupported seal version.')
  }

  const ivStart = 1
  const authTagStart = ivStart + FORGE_BYOK_IV_LENGTH
  const ciphertextStart = authTagStart + FORGE_BYOK_AUTH_TAG_LENGTH
  const iv = data.subarray(ivStart, authTagStart)
  const authTag = data.subarray(authTagStart, ciphertextStart)
  const ciphertext = data.subarray(ciphertextStart)
  const decipher = createDecipheriv(FORGE_BYOK_ALGORITHM, getForgeByokKey(), iv)
  decipher.setAAD(createForgeByokAdditionalData({ provider, userId }))
  decipher.setAuthTag(authTag)

  const payload = parseForgeByokSealPayload(
    JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf8',
      ),
    ),
  )

  if (
    payload.version !== FORGE_BYOK_SEAL_VERSION ||
    payload.userId !== userId ||
    payload.provider !== provider
  ) {
    throw new Error('Forge provider key does not match this user session.')
  }

  if (Date.parse(payload.expiresAt) <= Date.now()) {
    throw new Error('Forge provider key has expired. Add it again.')
  }

  return {
    apiKey: normalizeForgeProviderApiKey(payload.apiKey),
    model: normalizeForgeProviderModel(payload.model),
    provider: payload.provider,
  }
}

export function forgeRequiresByokForRuns() {
  return process.env.FORGE_REQUIRE_BYOK !== 'false'
}

function normalizeForgeProviderApiKey(apiKey: string) {
  const normalized = apiKey.trim()

  if (normalized.length < 20 || /\s/.test(normalized)) {
    throw new Error('Forge provider key does not look valid.')
  }

  return normalized
}

function normalizeForgeProviderModel(model: string | undefined) {
  const normalized = model?.trim()

  return normalized ? normalized : undefined
}

function getForgeByokKey() {
  const secret =
    process.env.FORGE_BYOK_SEALING_KEY ??
    process.env.SESSION_SECRET ??
    getLocalForgeByokDevelopmentSecret()

  return createHmac('sha256', secret).update('forge-byok-seal-v1').digest()
}

function getLocalForgeByokDevelopmentSecret() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FORGE_BYOK_SEALING_KEY or SESSION_SECRET is required for Forge BYOK.',
    )
  }

  return 'local-forge-byok-development-seal'
}

function createForgeByokAdditionalData({
  provider,
  userId,
}: {
  provider: ForgeByokProvider
  userId: string
}) {
  return Buffer.from(
    `tanstack-forge-byok:${FORGE_BYOK_SEAL_VERSION}:${userId}:${provider}`,
    'utf8',
  )
}

function fingerprintForgeProviderKey({
  apiKey,
  provider,
}: {
  apiKey: string
  provider: ForgeByokProvider
}) {
  return createHash('sha256')
    .update(`${provider}:${apiKey}`)
    .digest('hex')
    .slice(0, 16)
}

function labelForgeProviderKey({
  apiKey,
  provider,
}: {
  apiKey: string
  provider: ForgeByokProvider
}) {
  return `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} key ...${apiKey.slice(-4)}`
}

function parseForgeByokSealPayload(value: unknown): ForgeByokSealPayload {
  if (!isForgeByokSealPayload(value)) {
    throw new Error('Forge provider key has an invalid sealed payload.')
  }

  return value
}

function isForgeByokSealPayload(value: unknown): value is ForgeByokSealPayload {
  if (!isRecord(value)) {
    return false
  }

  const provider = value.provider
  const model = value.model

  return (
    value.version === FORGE_BYOK_SEAL_VERSION &&
    typeof value.apiKey === 'string' &&
    typeof value.expiresAt === 'string' &&
    typeof value.issuedAt === 'string' &&
    (model === undefined || typeof model === 'string') &&
    (provider === 'openai' || provider === 'anthropic') &&
    typeof value.userId === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
