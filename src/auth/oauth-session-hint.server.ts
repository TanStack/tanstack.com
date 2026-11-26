import { getAuthService } from './index.server'
import { SITE_URL } from '~/utils/site'

const SOURCE_ORIGIN = 'https://source.tanstack.com'

function avatarUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value, SITE_URL)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

/** A display hint for Source, never an authentication assertion. No cookie or token leaves this server. */
export async function handleSessionHint(request: Request) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    Pragma: 'no-cache',
    Vary: 'Origin, Cookie',
    'Cross-Origin-Resource-Policy': 'same-site',
  })
  if (request.headers.get('origin') !== SOURCE_ORIGIN)
    return new Response(null, { status: 403, headers })
  headers.set('Access-Control-Allow-Origin', SOURCE_ORIGIN)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers })
  const user = await getAuthService().getCurrentUser(request)
  const account = user
    ? {
        name: (
          user.name?.trim() ||
          user.displayUsername?.trim() ||
          user.email.split('@')[0]
        ).slice(0, 120),
        avatar: avatarUrl(user.image || user.oauthImage),
      }
    : null
  return Response.json({ account }, { headers })
}
