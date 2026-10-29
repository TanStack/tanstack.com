import { suppressTracing } from '@sentry/tanstackstart-react'
import { z } from 'zod'
import { liveCompanySchema } from './live'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'

export async function getLiveConfig() {
  const host = await getHostRuntimeEnv()
  const key = host?.SCARF_LOOKUP_KEY ?? process.env.SCARF_LOOKUP_KEY
  return {
    requestLimiter: host?.LIVE_PRESENCE_RATE_LIMITER,
    lookupLimiter: host?.LIVE_LOOKUP_RATE_LIMITER,
    enabled:
      (host?.LIVE_VISITORS_ENABLED ?? process.env.LIVE_VISITORS_ENABLED) ===
      'true',
    key: typeof key === 'string' && key ? key : undefined,
  }
}

export async function lookupScarfCompany(ip: string, key: string) {
  const url = new URL(
    'https://api.scarf.sh/v3/organizations/TanStack/ip-company',
  )
  // Without this parameter Scarf would look up the Worker's IP.
  url.searchParams.set('ip', ip)
  const response = await suppressTracing(() =>
    fetch(url, {
      headers: { 'X-Scarf-Lookup-Key': key },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    }),
  )
  if (!response.ok) throw new Error(`Scarf lookup returned ${response.status}`)
  return z
    .object({ company: liveCompanySchema.nullable() })
    .parse(await response.json()).company
}
