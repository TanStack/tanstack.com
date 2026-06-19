type StaticAssetService = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type HostRuntimeModule = {
  env: Record<string, unknown>
}

function isStaticAssetService(value: unknown): value is StaticAssetService {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetch' in value &&
    typeof value.fetch === 'function'
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

export async function fetchStaticAsset(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const staticAssets = await getStaticAssetService()
  return staticAssets ? staticAssets.fetch(input, init) : fetch(input, init)
}

export function shouldBypassPersistentCache() {
  return isIsolateRuntime()
}

export function supportsProcessDiagnostics() {
  return !isIsolateRuntime()
}
