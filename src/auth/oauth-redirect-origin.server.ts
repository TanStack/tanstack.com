import { env } from '~/utils/env'

export function getOAuthRedirectOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin

  if (shouldUseRequestOrigin()) {
    return requestOrigin
  }

  return trimTrailingSlash(env.SITE_URL) ?? requestOrigin
}

function shouldUseRequestOrigin() {
  return process.env.NODE_ENV !== 'production'
}

function trimTrailingSlash(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/\/+$/, '')
}
