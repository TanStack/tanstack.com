import { refreshAuthorization } from '@modelcontextprotocol/sdk/client/auth.js'
import { McpAccounts } from './mcp-accounts'
import { McpAccountError, type McpAccountScope } from './mcp-account-contract'
import type { CredentialEnv } from './credentials'
import type { McpEgressEnvironment } from './mcp-public-fetch'
import { authorizationFetch, McpAuthorizationError } from './mcp-auth-network'
import { validateDiscoveredOAuth } from './mcp-oauth-discovery'
import { publicMcpFetch } from './mcp-public-fetch'
import { withMcpClient, type McpConnection } from './mcp'

export async function refreshMcpAccount(
  env: CredentialEnv & McpEgressEnvironment,
  scope: McpAccountScope,
  id: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
) {
  const accounts = new McpAccounts(env, scope)
  const existing = await accounts.read(id)
  if (!existing.summary.enabled || existing.summary.status === 'needs_auth')
    return 'needs_auth' as const
  if (existing.secret?.authMode !== 'oauth') return 'not_needed' as const
  if (
    existing.secret.oauth.expiresAt === undefined ||
    existing.secret.oauth.expiresAt > Date.now() + 60000
  )
    return 'not_needed' as const
  // Validate the local/deployment transport before consuming a refresh lease.
  // A configuration error cannot have rotated the provider's token.
  const network = options.fetch ?? publicMcpFetch(env)
  options.signal?.throwIfAborted()
  const claim = await accounts.claimRefresh(id)
  if (claim.status !== 'claimed') return claim.status
  try {
    const current = await accounts.get(id),
      state = claim.secret
    if (!state.authorizationServerMetadata || !state.clientInformation)
      throw new Error('Incomplete OAuth state')
    validateDiscoveredOAuth(
      {
        issuer: state.authorizationServerUrl,
        metadata: state.authorizationServerMetadata,
        resource: state.resource,
        scope: state.tokens?.scope ?? '',
        registration: 'metadata',
      },
      current.url,
    )
    // Check claim ownership after all local reads and immediately before dispatch.
    await accounts.assertRefreshClaim(claim)
    options.signal?.throwIfAborted()
    const refreshed = await refreshAuthorization(state.authorizationServerUrl, {
      metadata: state.authorizationServerMetadata,
      clientInformation: state.clientInformation,
      refreshToken: state.tokens!.refresh_token!,
      resource: new URL(state.resource),
      fetchFn: authorizationFetch({
        fetch: network,
        signal: options.signal,
        allowedPosts: [state.authorizationServerMetadata.token_endpoint],
        allowedCredentialUrls: [
          state.authorizationServerMetadata.token_endpoint,
        ],
        allowedGets: [],
      }),
    })
    const tokens = {
      ...refreshed,
      scope: refreshed.scope ?? state.tokens?.scope,
    }
    if (state.tokens?.scope !== undefined && tokens.scope !== undefined) {
      const allowed = new Set(state.tokens.scope.split(' ').filter(Boolean))
      if (tokens.scope.split(' ').some((scope) => scope && !allowed.has(scope)))
        throw new Error('The refreshed token expanded its permissions')
    }
    if (
      tokens.token_type.toLowerCase() !== 'bearer' ||
      !tokens.access_token ||
      tokens.access_token.length > 16000 ||
      (tokens.expires_in !== undefined &&
        (!Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0))
    )
      throw new Error('Unsupported OAuth token')
    await accounts.completeRefresh({
      ...claim,
      state: {
        ...state,
        tokens,
        expiresAt:
          tokens.expires_in === undefined
            ? undefined
            : Date.now() + tokens.expires_in * 1000,
      },
    })
    return 'refreshed' as const
  } catch {
    // A refresh token may have rotated even when its response was lost. Never
    // repeat a potentially consumed refresh token or expose upstream error text.
    await accounts.failRefresh(claim, { ambiguous: true })
    return 'needs_auth' as const
  }
}

export async function runtimeMcpAccounts(
  env: CredentialEnv & McpEgressEnvironment,
  scope: McpAccountScope,
  options: { id?: string; fetch?: typeof fetch; signal?: AbortSignal } = {},
) {
  const accounts = new McpAccounts(env, scope)
  const summaries = (await accounts.list()).filter(
    (account) => account.enabled && (!options.id || account.id === options.id),
  )
  for (const account of summaries)
    if (account.authMode === 'oauth')
      await refreshMcpAccount(env, scope, account.id, options)
  const records = await Promise.all(
    summaries.map((account) => accounts.read(account.id)),
  )
  return records.flatMap((current) => {
    const server = current.summary,
      secret = current.secret
    if (!server.enabled || server.status === 'needs_auth') return []
    const oauth = secret?.authMode === 'oauth' ? secret.oauth : undefined
    if (oauth?.expiresAt !== undefined && oauth.expiresAt <= Date.now())
      return []
    const accessToken =
      secret?.authMode === 'token'
        ? secret.accessToken
        : oauth?.tokens?.access_token
    if (server.authMode !== 'none' && !accessToken) return []
    return [
      {
        id: server.id,
        label: server.label,
        url: server.url,
        enabled: true,
        accessToken,
        credentialId: current.grantId,
      },
    ]
  })
}

export async function checkMcpAccount(
  env: CredentialEnv & McpEgressEnvironment,
  scope: McpAccountScope,
  id: string,
  expectedRevision: number,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
) {
  const accounts = new McpAccounts(env, scope),
    current = await accounts.get(id)
  if (!current.enabled || current.revision !== expectedRevision)
    throw new McpAccountError(
      'This connection changed. Reload and try again.',
      409,
    )
  const server = (await runtimeMcpAccounts(env, scope, { ...options, id }))[0]
  if (!server)
    throw new McpAccountError('Sign in to this connection again.', 409)
  let ok = false,
    code: 'setup' | 'credentials' | 'network' | 'protocol' | undefined
  try {
    const connection: McpConnection = { ...server, id: 'mcp:' + server.id }
    await withMcpClient(connection, async () => {}, options.signal, {
      fetch: authorizationFetch({
        fetch: options.fetch ?? publicMcpFetch(env),
        signal: options.signal,
        allowedGets: [server.url],
        allowedPosts: [server.url],
        allowedCredentialUrls: [server.url],
      }),
    })
    ok = true
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined
    code =
      error instanceof McpAuthorizationError && error.status === 503
        ? 'setup'
        : status === 401 || status === 403
          ? 'credentials'
          : error instanceof TypeError ||
              (typeof status === 'number' && status >= 500) ||
              (error instanceof Error &&
                ['AbortError', 'TimeoutError'].includes(error.name))
            ? 'network'
            : 'protocol'
  }
  return accounts.recordCheck(id, expectedRevision, { ok, code })
}
