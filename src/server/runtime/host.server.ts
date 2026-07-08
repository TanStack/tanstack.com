type StaticAssetService = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type HostExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

type HostRuntimeModule = {
  env: Record<string, unknown> & {
    AI?: unknown
    CLOUDFLARE_CACHE_PURGE_TOKEN?: string
    CLOUDFLARE_ZONE_ID?: string
    FORGE_RUNTIME?: unknown
    FORGE_SESSIONS?: unknown
    GITHUB_CONTENT_CACHE?: unknown
    HYPERDRIVE?: {
      connectionString: string
    }
  }
}

type HostRuntimeEnv = HostRuntimeModule['env']

let hostRuntimeEnvOverride: HostRuntimeEnv | undefined
let hostExecutionContext: HostExecutionContext | undefined

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  if ('WebSocketPair' in globalThis) {
    return true
  }

  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined

  if (
    typeof userAgent === 'string' &&
    /\b(cloudflare|workerd|miniflare)\b/i.test(userAgent)
  ) {
    return true
  }

  const runtimeVersions =
    typeof process !== 'undefined' ? process.versions : undefined

  return (
    typeof runtimeVersions === 'object' &&
    runtimeVersions !== null &&
    'workerd' in runtimeVersions
  )
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
  if (hostRuntimeEnvOverride) return hostRuntimeEnvOverride

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

export function setHostRuntimeEnvOverrideForTest(
  env: HostRuntimeEnv | undefined,
) {
  hostRuntimeEnvOverride = env
}

export function runWithHostExecutionContext<T>(
  context: HostExecutionContext,
  task: () => T,
) {
  const previousContext = hostExecutionContext
  hostExecutionContext = context

  try {
    const result = task()

    Promise.resolve(result).finally(() => {
      if (hostExecutionContext === context) {
        hostExecutionContext = previousContext
      }
    })

    return result
  } catch (error) {
    hostExecutionContext = previousContext
    throw error
  }
}

export function waitUntilHostRuntime(promise: Promise<unknown>) {
  if (!hostExecutionContext) {
    return false
  }

  hostExecutionContext.waitUntil(promise)
  return true
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
