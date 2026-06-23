import type { Capability } from '~/db/types'

export const FORGE_CAPABILITY = 'forge' satisfies Capability

export function isForgeEnabled({
  enabled = readProcessEnv('FORGE_ENABLED'),
  nodeEnv = readProcessEnv('NODE_ENV'),
}: {
  enabled?: string
  nodeEnv?: string
} = {}) {
  return nodeEnv !== 'production' || enabled === 'true'
}

function readProcessEnv(name: string) {
  return typeof process === 'undefined' ? undefined : process.env[name]
}
