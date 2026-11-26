import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as tables from '~/db/schema'
import { SOURCE_RESOURCE, IDENTITY_RESOURCE } from '~/auth/oauth-resources'

const fixture = vi.hoisted(() => ({
  url: process.env.OAUTH_TEST_DATABASE_URL,
  close: async () => {},
}))
vi.mock('~/db/client', async () => {
  const { default: postgres } = await import('postgres')
  const { drizzle } = await import('drizzle-orm/postgres-js')
  if (!fixture.url) return { db: {} }
  const url = new URL(fixture.url)
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/shared_oauth_test')
    throw new Error(
      'OAuth tests require the disposable local shared_oauth_test database',
    )
  const client = postgres(fixture.url, { max: 8 })
  fixture.close = async () => {
    await client.end()
  }
  return { db: drizzle(client) }
})
vi.mock('~/utils/env.functions', () => ({
  envFunctions: {
    SESSION_SECRET: 'test-secret',
    TANSTACK_SOURCE_INTROSPECTION_SECRET: 'resource-secret',
  },
}))
import {
  createAuthorizationCode,
  createRegisteredClientId,
  exchangeAuthorizationCode,
  refreshAccessToken,
  introspectSourceToken,
  validateOAuthToken,
  revokeOAuthGrant,
  revokeTokensForClient,
  listConnectedApps,
} from '~/auth/oauthClient.server'
import {
  handleIntrospection,
  handleUserInfo,
} from '~/auth/oauth-endpoints.server'

const verifier = 'a'.repeat(43)
const userId = '00000000-0000-4000-8000-000000000001'
const redirectUri = 'https://client.test/callback'

describe.skipIf(!fixture.url)('OAuth grants in PostgreSQL', () => {
  const sql = postgres(fixture.url ?? 'postgres://invalid', { max: 4 })
  const db = drizzle(sql)
  let clientId: string
  let challenge: string
  beforeAll(async () => {
    await sql.unsafe(`CREATE TABLE users (id uuid PRIMARY KEY, email text, name text, display_username text);
      CREATE TABLE oauth_accounts (user_id uuid REFERENCES users(id), provider text, provider_account_id text);
      CREATE TABLE oauth_mcp_authorization_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code_hash varchar(64) UNIQUE NOT NULL, user_id uuid REFERENCES users(id), client_id varchar(255) NOT NULL, redirect_uri text NOT NULL, code_challenge varchar(128) NOT NULL, code_challenge_method varchar(8) NOT NULL DEFAULT 'S256', scope text NOT NULL DEFAULT 'api', expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE oauth_mcp_access_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash varchar(64) UNIQUE NOT NULL, user_id uuid REFERENCES users(id), client_id varchar(255) NOT NULL, scope text NOT NULL DEFAULT 'api', expires_at timestamptz NOT NULL, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE oauth_mcp_refresh_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash varchar(64) UNIQUE NOT NULL, user_id uuid REFERENCES users(id), client_id varchar(255) NOT NULL, access_token_id uuid REFERENCES oauth_mcp_access_tokens(id) ON DELETE SET NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`)
    await sql.unsafe(
      await readFile(
        new URL(
          '../../drizzle/migrations/0044_shared_oauth.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    clientId = await createRegisteredClientId({
      clientName: 'Test client',
      redirectUris: [redirectUri],
    })
    challenge = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ).toString('base64url')
  })
  beforeEach(async () => {
    await sql.unsafe(
      'TRUNCATE oauth_mcp_refresh_tokens, oauth_mcp_access_tokens, oauth_mcp_authorization_codes, oauth_accounts, users CASCADE',
    )
    await sql`INSERT INTO users (id, email, name, display_username) VALUES (${userId}, 'person@example.com', 'Person', 'person')`
  })
  afterAll(async () => {
    await sql.unsafe(
      'DROP TABLE oauth_mcp_refresh_tokens, oauth_mcp_access_tokens, oauth_mcp_authorization_codes, oauth_accounts, users CASCADE',
    )
    await sql.end()
    await fixture.close()
  })

  async function issue(resource: string | undefined = SOURCE_RESOURCE) {
    const code = await createAuthorizationCode({
      userId,
      clientId,
      redirectUri,
      codeChallenge: challenge,
      resource,
    })
    const result = await exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
      redirectUri,
      clientId,
      resource,
    })
    if (!result.success) throw new Error(result.error)
    return { ...result, code }
  }

  it('binds codes to the client, exact redirect and resource, and consumes them once', async () => {
    for (const override of [
      { clientId: 'other' },
      { redirectUri: redirectUri + '/' },
      { resource: IDENTITY_RESOURCE },
      { codeVerifier: 'b'.repeat(43) },
    ]) {
      const code = await createAuthorizationCode({
        userId,
        clientId,
        redirectUri,
        codeChallenge: challenge,
        resource: SOURCE_RESOURCE,
      })
      const params = {
        code,
        codeVerifier: verifier,
        redirectUri,
        clientId,
        resource: SOURCE_RESOURCE,
      }
      expect(
        await exchangeAuthorizationCode({ ...params, ...override }),
      ).toEqual({ success: false, error: 'invalid_grant' })
      expect(await exchangeAuthorizationCode(params)).toEqual({
        success: false,
        error: 'invalid_grant',
      })
    }
    const issued = await issue()
    expect(await introspectSourceToken(issued.accessToken)).toMatchObject({
      active: true,
      sub: userId,
      aud: SOURCE_RESOURCE,
      scope: 'source',
    })
    expect((await validateOAuthToken(issued.accessToken)).success).toBe(false)
    expect(
      await exchangeAuthorizationCode({
        code: issued.code,
        codeVerifier: verifier,
        redirectUri,
        clientId,
        resource: SOURCE_RESOURCE,
      }),
    ).toEqual({ success: false, error: 'invalid_grant' })
  })

  it('rotates refresh tokens without changing audience, scope or absolute expiry, and revokes on replay', async () => {
    const issued = await issue()
    expect(await listConnectedApps(userId)).toMatchObject([
      { clientName: 'Test client', clientId },
    ])
    const binding = { clientId, resource: SOURCE_RESOURCE }
    expect(
      (
        await refreshAccessToken(issued.refreshToken, {
          clientId,
          resource: IDENTITY_RESOURCE,
        })
      ).success,
    ).toBe(false)
    const rotated = await refreshAccessToken(issued.refreshToken, binding)
    expect(rotated).toMatchObject({ success: true, scope: 'source' })
    if (!rotated.success || !rotated.refreshToken)
      throw new Error('Expected rotating refresh token')
    expect(rotated.refreshToken).not.toBe(issued.refreshToken)
    expect(await introspectSourceToken(rotated.accessToken)).toMatchObject({
      active: true,
      aud: SOURCE_RESOURCE,
    })
    expect(
      (await refreshAccessToken(issued.refreshToken, binding)).success,
    ).toBe(false)
    expect(await introspectSourceToken(rotated.accessToken)).toEqual({
      active: false,
    })
    expect(
      (await refreshAccessToken(rotated.refreshToken, binding)).success,
    ).toBe(false)
  })

  it('serializes competing refreshes and revokes every token in the replayed grant', async () => {
    const issued = await issue()
    const results = await Promise.all([
      refreshAccessToken(issued.refreshToken, {
        clientId,
        resource: SOURCE_RESOURCE,
      }),
      refreshAccessToken(issued.refreshToken, {
        clientId,
        resource: SOURCE_RESOURCE,
      }),
    ])
    expect(results.filter((r) => r.success)).toHaveLength(1)
    for (const result of results)
      if (result.success)
        expect(await introspectSourceToken(result.accessToken)).toEqual({
          active: false,
        })
    expect(await introspectSourceToken(issued.accessToken)).toEqual({
      active: false,
    })
  })

  it('revokes connected apps and individual grants, including concurrent refreshes', async () => {
    const issued = await issue()
    await Promise.all([
      refreshAccessToken(issued.refreshToken, {
        clientId,
        resource: SOURCE_RESOURCE,
      }),
      revokeTokensForClient(userId, clientId),
    ])
    expect(await sql`SELECT * FROM oauth_mcp_access_tokens`).toHaveLength(0)
    expect(await sql`SELECT * FROM oauth_mcp_refresh_tokens`).toHaveLength(0)
    const another = await issue()
    await revokeOAuthGrant(another.refreshToken, clientId)
    expect(await introspectSourceToken(another.accessToken)).toEqual({
      active: false,
    })
  })

  it('keeps legacy grants and refresh tokens valid', async () => {
    const code = await createAuthorizationCode({
      userId,
      clientId,
      redirectUri,
      codeChallenge: challenge,
    })
    const issued = await exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
      redirectUri,
    })
    if (!issued.success) throw new Error(issued.error)
    expect((await validateOAuthToken(issued.accessToken)).success).toBe(true)
    expect((await refreshAccessToken(issued.refreshToken)).success).toBe(true)
    expect((await refreshAccessToken(issued.refreshToken)).success).toBe(true)
    expect(await introspectSourceToken(issued.accessToken)).toEqual({
      active: false,
    })
  })

  it('requires service authentication for introspection and isolates identity grants', async () => {
    const issued = await issue()
    const request = (authorization: string) =>
      new Request('https://tanstack.com/oauth/introspect', {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: issued.accessToken,
          resource: SOURCE_RESOURCE,
        }),
      })
    expect((await handleIntrospection(request('Bearer wrong'))).status).toBe(
      401,
    )
    expect(
      await (
        await handleIntrospection(request('Bearer resource-secret'))
      ).json(),
    ).toMatchObject({ active: true, sub: userId })
    await sql`INSERT INTO oauth_accounts (user_id, provider, provider_account_id) VALUES (${userId}, 'github', '583231')`
    expect(await introspectSourceToken(issued.accessToken)).toMatchObject({
      github_id: '583231',
    })
    const identity = await issue(IDENTITY_RESOURCE)
    expect(
      await (
        await handleUserInfo(
          new Request('https://tanstack.com/oauth/userinfo', {
            headers: { authorization: `Bearer ${identity.accessToken}` },
          }),
        )
      ).json(),
    ).toMatchObject({
      sub: userId,
      email: 'person@example.com',
      github_id: '583231',
    })
    expect(
      (
        await handleUserInfo(
          new Request('https://tanstack.com/oauth/userinfo', {
            headers: { authorization: `Bearer ${issued.accessToken}` },
          }),
        )
      ).status,
    ).toBe(401)
    await sql`INSERT INTO oauth_accounts (user_id, provider, provider_account_id) VALUES (${userId}, 'github', 'another-id')`
    expect(await introspectSourceToken(issued.accessToken)).toMatchObject({
      active: true,
      github_id: null,
    })
    await db
      .update(tables.oauthAccessTokens)
      .set({ expiresAt: new Date(0) })
      .where(eq(tables.oauthAccessTokens.userId, userId))
    expect(await introspectSourceToken(issued.accessToken)).toEqual({
      active: false,
    })
  })
})
