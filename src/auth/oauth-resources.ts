// Resource identities are exact, including the path. Existing grants keep their legacy null audience.
export const SOURCE_RESOURCE = 'https://source.tanstack.com/mcp'
export const IDENTITY_RESOURCE = 'https://tanstack.com/oauth/userinfo'
export const SOURCE_CLIENT = 'tanstack-source'
export const SOURCE_CALLBACK =
  'https://source.tanstack.com/auth/tanstack/callback'

export function authorizationGrant(
  resource?: string | null,
  scope?: string | null,
) {
  if (
    resource &&
    resource !== SOURCE_RESOURCE &&
    resource !== IDENTITY_RESOURCE &&
    resource !== 'https://tanstack.com/mcp'
  ) {
    throw new Error('invalid_target')
  }
  const expected =
    resource === SOURCE_RESOURCE
      ? 'source'
      : resource === IDENTITY_RESOURCE
        ? 'identity'
        : 'api'
  if (scope && scope !== expected) throw new Error('invalid_scope')
  return { resource: resource || null, scope: expected }
}
