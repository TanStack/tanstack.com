import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { requireAuth, getCurrentUser } from './auth.server'
import {
  listConnectedApps as listConnectedAppsService,
  revokeTokensForClient,
  createAuthorizationCode as createAuthorizationCodeService,
  validateRedirectUri as validateRedirectUriService,
} from '~/mcp/oauth.server'

/**
 * List the current user's connected OAuth apps
 */
export const listConnectedApps = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireAuth()

    const apps = await listConnectedAppsService(user.userId)

    return apps.map((app) => ({
      clientId: app.clientId,
      scope: app.scope,
      createdAt: app.createdAt.toISOString(),
      lastUsedAt: app.lastUsedAt?.toISOString() ?? null,
    }))
  },
)

/**
 * Revoke access for a connected OAuth app
 */
export const revokeConnectedApp = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      clientId: v.string(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireAuth()

    await revokeTokensForClient(user.userId, data.clientId)

    return { success: true }
  })

/**
 * Create an OAuth authorization code
 */
export const createAuthorizationCode = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      clientId: v.string(),
      redirectUri: v.string(),
      codeChallenge: v.string(),
      codeChallengeMethod: v.optional(v.string()),
      scope: v.optional(v.string()),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Validate redirect URI
    if (!validateRedirectUriService(data.redirectUri)) {
      throw new Error('Invalid redirect URI')
    }

    const code = await createAuthorizationCodeService({
      userId: user.userId,
      clientId: data.clientId,
      redirectUri: data.redirectUri,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod || 'S256',
      scope: data.scope || 'mcp',
    })

    return { code }
  })
