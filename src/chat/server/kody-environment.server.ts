import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import type { KodyEnvironment } from './kody'
export class KodyEnvironmentError extends Error {
  readonly status = 503
}
export async function getKodyEnvironment(): Promise<KodyEnvironment> {
  const env = await getHostRuntimeEnv()
  const origin = env?.KODY_ORIGIN ?? process.env.KODY_ORIGIN
  const key = env?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY
  // An unconfigured optional integration must not block private skill storage.
  if (typeof origin !== 'string' || !origin.trim())
    return {
      KODY_ORIGIN: '',
      ENCRYPTION_KEY: typeof key === 'string' ? key : '',
    }
  if (typeof key !== 'string' || key.length < 32)
    throw new KodyEnvironmentError(
      'Connected account storage is not configured.',
    )
  return { KODY_ORIGIN: origin, ENCRYPTION_KEY: key }
}
