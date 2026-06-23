import { getRequest } from '@tanstack/react-start/server'
import { AuthError, getAuthGuards, type AuthUser } from '~/auth/index.server'
import { FORGE_CAPABILITY, isForgeEnabled } from '~/utils/forge-access'
export { FORGE_CAPABILITY, isForgeEnabled } from '~/utils/forge-access'

export function assertForgeEnabled() {
  if (!isForgeEnabled()) {
    throw new Error('Forge is not enabled.')
  }
}

export async function requireForgeAccess(
  request: Request = getRequest(),
): Promise<AuthUser> {
  assertForgeEnabled()
  return getAuthGuards().requireCapability(request, FORGE_CAPABILITY)
}

export function getForgeAccessErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    if (error.code === 'NOT_AUTHENTICATED') {
      return Response.json(
        { code: 'NOT_AUTHENTICATED', error: 'Not authenticated' },
        { status: 401 },
      )
    }

    if (error.code === 'MISSING_CAPABILITY') {
      return Response.json(
        { code: 'MISSING_CAPABILITY', error: 'Forge access required' },
        { status: 403 },
      )
    }
  }

  const message = error instanceof Error ? error.message : 'Forge unavailable'
  const status = message === 'Forge is not enabled.' ? 404 : 403

  return Response.json(
    { code: 'FORGE_UNAVAILABLE', error: message },
    { status },
  )
}
