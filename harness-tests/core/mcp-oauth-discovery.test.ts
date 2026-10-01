import { describe, expect, it, vi } from 'vitest'
import { discoverMcpSetup } from '../../src/chat/server/mcp-oauth-discovery'
import {
  authorizationFetch,
  validateOAuthUrl,
} from '../../src/chat/server/mcp-auth-network'

const endpoint = 'https://tools.example.com/team/mcp'
const prm =
  'https://tools.example.com/.well-known/oauth-protected-resource/team/mcp'
const issuer = 'https://auth.example.com/tenant'
const oauthMetadata =
  'https://auth.example.com/.well-known/oauth-authorization-server/tenant'
const metadata = () => ({
  issuer,
  authorization_endpoint: 'https://auth.example.com/authorize?tenant=one',
  token_endpoint: 'https://auth.example.com/token',
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  client_id_metadata_document_supported: true,
})
function fixture(
  options: {
    challenge?: string
    resource?: Record<string, unknown>
    metadata?: Record<string, unknown>
    routes?: Record<string, () => Response>
    public?: boolean
  } = {},
) {
  const requests: Request[] = []
  const methods: string[] = []
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    expect(request.redirect).toBe('manual')
    expect(request.headers.get('authorization')).toBeNull()
    expect(request.headers.get('cookie')).toBeNull()
    if (request.url === endpoint) {
      if (request.method === 'GET') return new Response(null, { status: 405 })
      const body = (await request.json()) as { id?: number; method: string }
      methods.push(body.method)
      if (!options.public)
        return new Response(null, {
          status: 401,
          headers: {
            'www-authenticate':
              options.challenge ?? `Bearer resource_metadata="${prm}"`,
          },
        })
      if (body.method === 'initialize')
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: { tools: {}, resources: {}, prompts: {} },
            serverInfo: { name: 'Synthetic server', version: '1' },
          },
        })
      if (body.method === 'notifications/initialized')
        return new Response(null, { status: 202 })
      throw Error('Unexpected MCP operation: ' + body.method)
    }
    if (options.routes?.[request.url]) return options.routes[request.url]()
    if (request.url === prm)
      return Response.json(
        options.resource ?? {
          resource: endpoint,
          authorization_servers: [issuer],
          scopes_supported: ['notes:read', 'notes:write'],
        },
      )
    if (request.url === oauthMetadata)
      return Response.json(options.metadata ?? metadata())
    return new Response(null, { status: 404 })
  })
  return {
    requests,
    methods,
    fetcher,
    run: (clientMetadataAvailable = true) =>
      discoverMcpSetup(endpoint, { fetch: fetcher, clientMetadataAvailable }),
  }
}

describe('MCP setup discovery through the real SDK transport', () => {
  it('initializes a public server without listing or calling its capabilities', async () => {
    const f = fixture({ public: true })
    expect(await f.run()).toMatchObject({
      kind: 'public',
      checkedAt: expect.any(Number),
    })
    expect(f.methods).toEqual(['initialize', 'notifications/initialized'])
    expect(f.requests.every((r) => r.url === endpoint)).toBe(true)
  })
  it('uses the challenge metadata, advertised issuer and CIMD without invoking a tool', async () => {
    const f = fixture()
    expect(await f.run()).toMatchObject({
      kind: 'oauth',
      oauth: {
        issuer,
        resource: endpoint,
        scope: 'notes:read notes:write',
        registration: 'metadata',
      },
    })
    expect(f.methods).toEqual(['initialize'])
    expect(f.requests.map((r) => r.url)).toEqual([endpoint, prm, oauthMetadata])
  })
  it('gives the challenge scopes precedence and deduplicates them', async () => {
    const f = fixture({
      challenge: `Bearer resource_metadata="${prm}", scope="special:read special:read"`,
    })
    expect(await f.run()).toMatchObject({ oauth: { scope: 'special:read' } })
  })
  it.each(['challenge', 'resource'] as const)(
    'omits offline access from %s scopes unless the authorization server advertises it',
    async (source) => {
      for (const advertised of [
        undefined,
        ['notes:read'],
        ['OFFLINE_ACCESS'],
      ]) {
        const f = fixture({
          ...(source === 'challenge'
            ? {
                challenge: `Bearer resource_metadata="${prm}", scope="special:read offline_access"`,
              }
            : {
                resource: {
                  resource: endpoint,
                  authorization_servers: [issuer],
                  scopes_supported: ['special:read', 'offline_access'],
                },
              }),
          metadata: { ...metadata(), scopes_supported: advertised },
        })
        // Ordinary challenged scopes stay authoritative even when they are
        // absent from AS scopes_supported. Offline access has a separate rule.
        expect(await f.run()).toMatchObject({
          oauth: { scope: 'special:read' },
        })
      }
    },
  )
  it.each(['challenge', 'resource'] as const)(
    'retains advertised offline access from %s scopes exactly once',
    async (source) => {
      const f = fixture({
        ...(source === 'challenge'
          ? {
              challenge: `Bearer resource_metadata="${prm}", scope="notes:read offline_access offline_access"`,
            }
          : {
              resource: {
                resource: endpoint,
                authorization_servers: [issuer],
                scopes_supported: [
                  'notes:read',
                  'offline_access',
                  'offline_access',
                ],
              },
            }),
        metadata: { ...metadata(), scopes_supported: ['offline_access'] },
      })
      expect(await f.run()).toMatchObject({
        oauth: { scope: 'notes:read offline_access' },
      })
    },
  )
  it('does not add offline access solely because the authorization server supports it', async () => {
    const f = fixture({
      metadata: { ...metadata(), scopes_supported: ['offline_access'] },
    })
    expect(await f.run()).toMatchObject({
      oauth: { scope: 'notes:read notes:write' },
    })
  })
  it('leaves an empty scope instead of falling back to broader resource permissions', async () => {
    const f = fixture({
      challenge: `Bearer resource_metadata="${prm}", scope="offline_access"`,
    })
    expect(await f.run()).toMatchObject({ oauth: { scope: '' } })
  })
  it('tries path-specific then root resource metadata when no metadata challenge exists', async () => {
    const rootPrm =
      'https://tools.example.com/.well-known/oauth-protected-resource'
    const f = fixture({
      challenge: 'Bearer',
      routes: {
        [prm]: () => new Response(null, { status: 404 }),
        [rootPrm]: () =>
          Response.json({
            resource: 'https://tools.example.com/',
            authorization_servers: [issuer],
          }),
      },
    })
    expect(await f.run()).toMatchObject({
      oauth: { scope: '', resource: 'https://tools.example.com/' },
    })
    expect(f.requests.map((r) => r.url)).toEqual([
      endpoint,
      prm,
      rootPrm,
      oauthMetadata,
    ])
  })
  it('tries both OIDC locations in order for a path-bearing issuer', async () => {
    const inserted =
      'https://auth.example.com/.well-known/openid-configuration/tenant'
    const appended =
      'https://auth.example.com/tenant/.well-known/openid-configuration'
    const f = fixture({
      routes: {
        [oauthMetadata]: () => new Response(null, { status: 404 }),
        [appended]: () => Response.json(metadata()),
      },
    })
    expect(await f.run()).toMatchObject({ kind: 'oauth' })
    expect(f.requests.map((r) => r.url)).toEqual([
      endpoint,
      prm,
      oauthMetadata,
      inserted,
      appended,
    ])
  })
  it('uses DCR only when advertised and CIMD is unavailable', async () => {
    const f = fixture({
      metadata: {
        ...metadata(),
        registration_endpoint: 'https://auth.example.com/register',
      },
    })
    expect(await f.run(false)).toMatchObject({
      oauth: { registration: 'dynamic' },
    })
    expect(f.requests.every((r) => !r.url.endsWith('/register'))).toBe(true)
  })
  it('reports a pre-registered app requirement instead of guessing a registration endpoint', async () => {
    const f = fixture()
    await expect(f.run(false)).rejects.toThrow('pre-registered OAuth app')
    expect(f.requests).toHaveLength(3)
  })
  it.each([
    [
      'issuer mismatch',
      { ...metadata(), issuer: 'https://auth.example.com/tenant/' },
      'issuer',
    ],
    [
      'missing PKCE advertisement',
      { ...metadata(), code_challenge_methods_supported: undefined },
      'S256 PKCE',
    ],
    [
      'plain-only PKCE',
      { ...metadata(), code_challenge_methods_supported: ['plain'] },
      'S256 PKCE',
    ],
    [
      'non-browser grant',
      { ...metadata(), grant_types_supported: ['client_credentials'] },
      'browser sign-in',
    ],
    [
      'unsafe token endpoint',
      { ...metadata(), token_endpoint: 'https://127.0.0.1/token' },
      'unsupported authorization address',
    ],
  ])('rejects %s', async (_label, meta, expected) => {
    await expect(
      fixture({ metadata: meta as Record<string, unknown> }).run(),
    ).rejects.toThrow(expected as string)
  })
  it.each([
    'https://other.example.com/mcp',
    'https://tools.example.com/team/mc',
    'https://tools.example.com/team/mcp/child',
  ])(
    'rejects a resource that cannot represent the requested MCP endpoint: %s',
    async (resource) => {
      await expect(
        fixture({
          resource: { resource, authorization_servers: [issuer] },
        }).run(),
      ).rejects.toThrow('resource does not match')
    },
  )
  it('does not fall back to another issuer or the MCP origin after invalid issuer metadata', async () => {
    const f = fixture({
      resource: {
        resource: endpoint,
        authorization_servers: [issuer, 'https://second.example.com'],
      },
      metadata: { ...metadata(), issuer: 'https://attacker.example.com' },
    })
    await expect(f.run()).rejects.toThrow('issuer')
    expect(f.requests.map((r) => r.url)).toEqual([endpoint, prm, oauthMetadata])
  })
  it('rejects a redirected resource document without contacting the location', async () => {
    const f = fixture({
      routes: {
        [prm]: () =>
          new Response(null, {
            status: 302,
            headers: { Location: 'https://other.example.com/metadata' },
          }),
      },
    })
    await expect(f.run()).rejects.toThrow('redirected')
    expect(f.requests).toHaveLength(2)
  })
  it('does not expose arbitrary provider response bodies in a public error', async () => {
    const f = fixture({
      routes: {
        [prm]: () => new Response('private-upstream-value', { status: 500 }),
      },
    })
    await expect(f.run()).rejects.toMatchObject({
      message: expect.not.stringContaining('private-upstream-value'),
    })
  })
})

describe('OAuth network request boundary', () => {
  it.each([
    'http://example.com',
    'https://localhost/a',
    'https://127.1/a',
    'https://[::1]/a',
    'https://user:secret@example.com/a',
    'https://example.com/a#fragment',
    'https://example.com:8443/a',
  ])('rejects unsupported destinations before transport: %s', (url) => {
    expect(() => validateOAuthUrl(url)).toThrow(
      'unsupported authorization address',
    )
  })
  it('permits query parameters on an OAuth endpoint without permitting credentials', () => {
    expect(validateOAuthUrl('https://auth.example.com/oauth?tenant=one')).toBe(
      'https://auth.example.com/oauth?tenant=one',
    )
  })
  it('keeps resource credentials and cookies out of discovery and rejects unreviewed token destinations', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({}))
    const network = authorizationFetch({
      fetch: transport,
      allowedPosts: ['https://auth.example.com/token'],
      allowedCredentialUrls: ['https://auth.example.com/token'],
    })
    await expect(
      network(prm, { headers: { Authorization: 'Bearer resource-only' } }),
    ).rejects.toThrow('Credentials')
    await expect(
      network('https://auth.example.com/token', {
        method: 'POST',
        headers: { Cookie: 'private=session' },
      }),
    ).rejects.toThrow('Credentials')
    await expect(
      network('https://other.example.com/token', { method: 'POST' }),
    ).rejects.toThrow('outside')
    expect(transport).not.toHaveBeenCalled()
    await network('https://auth.example.com/token', {
      method: 'POST',
      headers: { Authorization: 'Basic client-only' },
    })
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('bounds streamed bytes even when Content-Length is absent or understated', async () => {
    const network = authorizationFetch({
      maxBytes: 4,
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('123'))
              controller.enqueue(new TextEncoder().encode('456'))
              controller.close()
            },
          }),
          { headers: { 'Content-Length': '1' } },
        ),
    })
    const response = await network(prm)
    await expect(response.text()).rejects.toThrow('too large')
  })
  it('bounds request count independently of body size and endpoint', async () => {
    const transport = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    )
    const network = authorizationFetch({ fetch: transport })
    for (let i = 0; i < 12; i++) await network(prm)
    await expect(network(prm)).rejects.toThrow('too many')
    expect(transport).toHaveBeenCalledTimes(12)
  })
  it('propagates cancellation to the actual fetch', async () => {
    const controller = new AbortController()
    controller.abort()
    let aborted = false
    const network = authorizationFetch({
      signal: controller.signal,
      fetch: async (input, init) => {
        aborted = new Request(input, init).signal.aborted
        throw new DOMException('Aborted', 'AbortError')
      },
    })
    await expect(network(prm)).rejects.toMatchObject({ name: 'AbortError' })
    expect(aborted).toBe(true)
  })
})
