import { describe, expect, it, vi } from 'vitest'
vi.mock('~/db/client', () => ({ db: {} }))
vi.mock('~/utils/env.functions', () => ({
  envFunctions: { SESSION_SECRET: 'test-secret' },
}))
import {
  createRegisteredClientId,
  validateOAuthClientRedirectUri,
  validateRedirectUri,
  verifyCodeChallenge,
} from '~/auth/oauthClient.server'
import {
  authorizationGrant,
  SOURCE_RESOURCE,
  IDENTITY_RESOURCE,
} from '~/auth/oauth-resources'

describe('shared TanStack authorization', () => {
  it('bounds a grant to its resource and scope', () => {
    expect(authorizationGrant(SOURCE_RESOURCE, 'source')).toEqual({
      resource: SOURCE_RESOURCE,
      scope: 'source',
    })
    expect(authorizationGrant(IDENTITY_RESOURCE, 'identity')).toEqual({
      resource: IDENTITY_RESOURCE,
      scope: 'identity',
    })
    expect(() => authorizationGrant(SOURCE_RESOURCE, 'api')).toThrow(
      'invalid_scope',
    )
    expect(() => authorizationGrant('https://evil.test/mcp', 'source')).toThrow(
      'invalid_target',
    )
    expect(authorizationGrant(undefined, undefined)).toEqual({
      resource: null,
      scope: 'api',
    })
  })
  it('pre-registers only the Source callback', async () => {
    expect(
      await validateOAuthClientRedirectUri(
        'tanstack-source',
        'https://source.tanstack.com/auth/tanstack/callback',
      ),
    ).toBe(true)
    expect(
      await validateOAuthClientRedirectUri(
        'tanstack-source',
        'https://evil.test/auth/tanstack/callback',
      ),
    ).toBe(false)
  })
  it('matches registered redirects exactly and refuses fragments', async () => {
    const client = await createRegisteredClientId({
      clientName: 'Test',
      redirectUris: ['https://client.test/callback'],
    })
    expect(
      await validateOAuthClientRedirectUri(
        client,
        'https://client.test/callback',
      ),
    ).toBe(true)
    expect(
      await validateOAuthClientRedirectUri(
        client,
        'https://client.test/callback/',
      ),
    ).toBe(false)
    expect(validateRedirectUri('https://client.test/callback#fragment')).toBe(
      false,
    )
  })
  it('requires RFC 7636 verifiers', async () => {
    const verifier = 'a'.repeat(43)
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    )
    const challenge = Buffer.from(digest).toString('base64url')
    expect(await verifyCodeChallenge(verifier, challenge)).toBe(true)
    expect(await verifyCodeChallenge('short', challenge)).toBe(false)
  })
})
