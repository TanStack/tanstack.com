import { AsyncLocalStorage } from 'node:async_hooks'

type StaticAssetService = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type HostRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_CACHE_PURGE_TOKEN?: string
  CLOUDFLARE_ZONE_ID?: string
  GITHUB_CONTENT_CACHE?: unknown
  HYPERDRIVE?: {
    connectionString: string
  }
  NPM_DOWNLOAD_CACHE?: unknown
}

type HostRuntimeModule = {
  env: HostRuntimeEnv
}

const hostRuntimeEnvStorage = new AsyncLocalStorage<HostRuntimeEnv>()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHostRuntimeEnv(value: unknown): value is HostRuntimeEnv {
  return isObject(value)
}

function isStaticAssetService(value: unknown): value is StaticAssetService {
  return (
    isObject(value) && 'fetch' in value && typeof value.fetch === 'function'
  )
}

function isHyperdriveBinding(
  value: unknown,
): value is { connectionString: string } {
  return (
    isObject(value) &&
    'connectionString' in value &&
    typeof value.connectionString === 'string'
  )
}

export function isIsolateRuntime(): boolean {
  if ('WebSocketPair' in globalThis) return true

  return (
    typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers'
  )
}

export function runWithHostRuntimeEnv<T>(env: unknown, fn: () => T): T {
  if (!isHostRuntimeEnv(env)) {
    return fn()
  }

  return hostRuntimeEnvStorage.run(env, fn)
}

async function getStaticAssetService() {
  if (!isIsolateRuntime()) return

  const hostRuntimeSpecifier = 'cloudflare' + ':workers'
  try {
    const { env }: HostRuntimeModule = await import(
      /* @vite-ignore */
      hostRuntimeSpecifier
    )

    return isStaticAssetService(env.ASSETS) ? env.ASSETS : undefined
  } catch {
    return undefined
  }
}

export async function getHostRuntimeEnv() {
  const scopedEnv = hostRuntimeEnvStorage.getStore()
  if (scopedEnv) return scopedEnv

  if (!isIsolateRuntime()) return

  const hostRuntimeSpecifier = 'cloudflare' + ':workers'
  try {
    const { env }: HostRuntimeModule = await import(
      /* @vite-ignore */
      hostRuntimeSpecifier
    )

    return env
  } catch {
    return undefined
  }
}

export async function fetchStaticAsset(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const staticAssets = await getStaticAssetService()
  return staticAssets ? staticAssets.fetch(input, init) : fetch(input, init)
}

export async function getDatabaseConnectionString() {
  const hostEnv = await getHostRuntimeEnv()

  if (isHyperdriveBinding(hostEnv?.HYPERDRIVE)) {
    return hostEnv.HYPERDRIVE.connectionString
  }

  const hostDatabaseUrl = hostEnv?.DATABASE_URL
  if (typeof hostDatabaseUrl === 'string') {
    return hostDatabaseUrl
  }

  return process.env.DATABASE_URL
}

function getStringEnvValue(
  hostEnv: Record<string, unknown> | undefined,
  key: string,
) {
  const hostValue = hostEnv?.[key]
  if (typeof hostValue === 'string' && hostValue.length > 0) {
    return hostValue
  }

  const processValue = process.env[key]
  return typeof processValue === 'string' && processValue.length > 0
    ? processValue
    : undefined
}

export async function purgeHostCacheTags(tags: Array<string>) {
  const hostEnv = await getHostRuntimeEnv()
  const zoneId = getStringEnvValue(hostEnv, 'CLOUDFLARE_ZONE_ID')
  const token = getStringEnvValue(hostEnv, 'CLOUDFLARE_CACHE_PURGE_TOKEN')

  if (!zoneId || !token) {
    return undefined
  }

  return fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      body: JSON.stringify({ tags }),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
}

export function supportsProcessDiagnostics() {
  return !isIsolateRuntime()
}
