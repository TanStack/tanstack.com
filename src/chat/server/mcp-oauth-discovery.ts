import {
  buildDiscoveryUrls,
  extractWWWAuthenticateParams,
} from '@modelcontextprotocol/sdk/client/auth.js'
import {
  OAuthMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
  type AuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { withMcpClient } from './mcp'
import { validateMcpEndpoint } from './public-endpoint'
import {
  authorizationFetch,
  McpAuthorizationError,
  validateOAuthUrl,
} from './mcp-auth-network'

export interface DiscoveredMcpOAuth {
  issuer: string
  metadata: AuthorizationServerMetadata
  resource: string
  scope: string
  registration: 'metadata' | 'dynamic'
}
export type McpSetupDiscovery =
  | { kind: 'public'; checkedAt: number }
  | { kind: 'oauth'; oauth: DiscoveredMcpOAuth }

function scopeString(raw?: string) {
  if (!raw) return ''
  if (raw.length > 4096 || !/^[\x21\x23-\x5b\x5d-\x7e ]+$/.test(raw))
    throw new McpAuthorizationError(
      'This service supplied unsupported permission names.',
    )
  const scopes = [...new Set(raw.split(' ').filter(Boolean))]
  if (scopes.length > 64)
    throw new McpAuthorizationError(
      'This service requested too many permissions.',
    )
  return scopes.join(' ')
}

export function validateDiscoveredOAuth(
  value: DiscoveredMcpOAuth,
  endpoint: string,
) {
  const issuer = new URL(validateOAuthUrl(value.issuer))
  if (issuer.search || value.metadata.issuer !== value.issuer)
    throw new McpAuthorizationError(
      'The authorization issuer does not match this service.',
    )
  const resource = new URL(validateOAuthUrl(value.resource)),
    target = new URL(validateMcpEndpoint(endpoint))
  const resourcePath = resource.pathname.replace(/\/$/, '')
  if (
    resource.search ||
    resource.origin !== target.origin ||
    !(
      target.pathname === resourcePath ||
      target.pathname.startsWith(resourcePath + '/')
    )
  )
    throw new McpAuthorizationError(
      'The authorization resource does not match this service.',
    )
  validateOAuthUrl(value.metadata.authorization_endpoint)
  validateOAuthUrl(value.metadata.token_endpoint)
  if (value.metadata.registration_endpoint)
    validateOAuthUrl(value.metadata.registration_endpoint)
  if (
    !value.metadata.response_types_supported.includes('code') ||
    !value.metadata.code_challenge_methods_supported?.includes('S256')
  )
    throw new McpAuthorizationError(
      'This service must support authorization code sign-in with S256 PKCE.',
    )
  if (
    value.metadata.grant_types_supported &&
    !value.metadata.grant_types_supported.includes('authorization_code')
  )
    throw new McpAuthorizationError(
      'This service does not support browser sign-in.',
    )
  scopeString(value.scope)
  return value
}

/** Explicit setup probe: initialize only. No tools, prompts or resources are invoked. */
export async function discoverMcpSetup(
  endpoint: string,
  options: {
    signal?: AbortSignal
    fetch?: typeof fetch
    clientMetadataAvailable: boolean
  },
): Promise<McpSetupDiscovery> {
  endpoint = validateMcpEndpoint(endpoint)
  const observed: { challenge?: string } = {}
  const probeFetch = authorizationFetch({
    signal: options.signal,
    fetch: options.fetch,
    allowedPosts: [endpoint],
    allowedGets: [endpoint],
  })
  try {
    await withMcpClient(
      { id: 'setup', label: 'Setup', url: endpoint },
      async () => {},
      options.signal,
      {
        fetch: async (input, init) => {
          const result = await probeFetch(input, init)
          if (result.status === 401)
            observed.challenge = result.headers.get('www-authenticate') ?? ''
          return result
        },
      },
    )
    return { kind: 'public', checkedAt: Date.now() }
  } catch {
    if (observed.challenge === undefined)
      throw new McpAuthorizationError(
        'The service did not complete an MCP connection check. Check its address and try again.',
        502,
      )
  }
  const challenge = observed.challenge ?? ''
  if (
    challenge.length > 8192 ||
    (challenge && !/^Bearer(?:\s|$)/i.test(challenge))
  )
    throw new McpAuthorizationError(
      'This service requires an unsupported sign-in method.',
    )
  const fields = extractWWWAuthenticateParams(
    new Response(null, {
      status: 401,
      headers: { 'WWW-Authenticate': challenge },
    }),
  )
  if (/resource_metadata\s*=/.test(challenge) && !fields.resourceMetadataUrl)
    throw new McpAuthorizationError(
      'This service supplied an invalid authorization metadata address.',
    )
  const network = authorizationFetch({
    signal: options.signal,
    fetch: options.fetch,
  })
  const target = new URL(endpoint)
  const candidates = fields.resourceMetadataUrl
    ? [fields.resourceMetadataUrl.href]
    : [
        ...new Set([
          new URL(
            '/.well-known/oauth-protected-resource' +
              target.pathname.replace(/\/$/, ''),
            target.origin,
          ).href,
          new URL('/.well-known/oauth-protected-resource', target.origin).href,
        ]),
      ]
  let resource:
    | ReturnType<typeof OAuthProtectedResourceMetadataSchema.parse>
    | undefined
  for (const candidate of candidates) {
    const response = await network(validateOAuthUrl(candidate), {
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) {
      await response.body?.cancel()
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new McpAuthorizationError(
        'Could not read this service’s authorization metadata.',
        502,
      )
    }
    const parsed = OAuthProtectedResourceMetadataSchema.safeParse(
      await response.json(),
    )
    if (!parsed.success)
      throw new McpAuthorizationError(
        'This service returned invalid authorization metadata.',
      )
    resource = parsed.data
    break
  }
  if (!resource?.authorization_servers?.length)
    throw new McpAuthorizationError(
      'This service does not publish the metadata needed for automatic sign-in. It may require a manually configured token.',
    )
  if (resource.authorization_servers.length > 8)
    throw new McpAuthorizationError(
      'This service advertises too many authorization servers.',
    )
  if (
    resource.dpop_bound_access_tokens_required ||
    resource.tls_client_certificate_bound_access_tokens
  )
    throw new McpAuthorizationError(
      'This service requires a token security method TanChat does not support yet.',
    )
  // One advertised issuer is selected deterministically and shown before sign-in.
  // Invalid metadata never silently switches the user to another issuer.
  const issuer = resource.authorization_servers[0]
  validateOAuthUrl(issuer)
  let metadata: AuthorizationServerMetadata | undefined
  for (const candidate of buildDiscoveryUrls(issuer)) {
    const response = await network(candidate.url, {
      headers: { Accept: 'application/json' },
    })
    if (response.status === 404) {
      await response.body?.cancel()
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new McpAuthorizationError(
        'Could not read the sign-in provider’s metadata.',
        502,
      )
    }
    const parsed = OAuthMetadataSchema.safeParse(await response.json())
    if (!parsed.success)
      throw new McpAuthorizationError(
        'The sign-in provider returned invalid metadata.',
      )
    metadata = parsed.data
    break
  }
  if (!metadata)
    throw new McpAuthorizationError(
      'The sign-in provider does not publish supported authorization metadata.',
    )
  const registration =
    options.clientMetadataAvailable &&
    metadata.client_id_metadata_document_supported
      ? 'metadata'
      : metadata.registration_endpoint
        ? 'dynamic'
        : undefined
  if (!registration)
    throw new McpAuthorizationError(
      'This service requires a pre-registered OAuth app. Automatic setup is unavailable for this address.',
    )
  const requestedScope = scopeString(
    fields.scope ?? resource.scopes_supported?.join(' '),
  )
  const scope = metadata.scopes_supported?.includes('offline_access')
    ? requestedScope
    : requestedScope
        .split(' ')
        .filter((value) => value !== 'offline_access')
        .join(' ')
  const oauth = validateDiscoveredOAuth(
    {
      issuer,
      metadata,
      resource: resource.resource,
      scope,
      registration,
    },
    endpoint,
  )
  return { kind: 'oauth', oauth }
}
