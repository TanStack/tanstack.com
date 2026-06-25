import type { Capability } from '~/db/types'
import type { AuthUser } from '~/auth/index.server'

export const FORGE_CAPABILITY = 'forge' satisfies Capability
export const FORGE_AUTH_BYPASS_USER_ID = '00000000-0000-4000-8000-000000000001'

export function isForgeEnabled({
  enabled = readProcessEnv('FORGE_ENABLED'),
}: {
  enabled?: string
} = {}) {
  return enabled !== 'false'
}

export function isForgeAuthBypassEnabled({
  bypass = readProcessEnv('FORGE_AUTH_BYPASS'),
}: {
  bypass?: string
} = {}) {
  return bypass === 'true'
}

export function createForgeBypassUser(): AuthUser {
  return {
    adsDisabled: true,
    capabilities: [FORGE_CAPABILITY],
    displayUsername: 'forge-proof',
    email: 'forge-proof@tanstack.local',
    image: null,
    interestedInHidingAds: null,
    lastUsedFramework: null,
    name: 'Forge Proof',
    oauthImage: null,
    signupSources: [],
    userId: FORGE_AUTH_BYPASS_USER_ID,
  }
}

function readProcessEnv(name: string) {
  return typeof process === 'undefined' ? undefined : process.env[name]
}
