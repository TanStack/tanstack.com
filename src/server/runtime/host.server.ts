type StaticAssetService = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type HostRuntimeModule = {
  env: Record<string, unknown> & {
    HYPERDRIVE?: {
      connectionString: string
    }
  }
}

function isStaticAssetService(value: unknown): value is StaticAssetService {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetch' in value &&
    typeof value.fetch === 'function'
  )
}

function isHyperdriveBinding(
  value: unknown,
): value is { connectionString: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
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

async function getHostRuntimeEnv() {
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

export function shouldBypassPersistentCache() {
  return isIsolateRuntime()
}

export function supportsProcessDiagnostics() {
  return !isIsolateRuntime()
}
