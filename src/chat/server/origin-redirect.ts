import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '../core/navigation'

/** The alias has no session or API surface. Only validated UI navigation crosses
 * to the canonical site, never OAuth parameters, authorization, or request bodies. */
export function redirectChatOrigin(request: Request): Response | undefined {
  const source = new URL(request.url)
  if (source.hostname !== 'chat.tanstack.com') return undefined
  const headers = {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, {
      status: 405,
      headers: { ...headers, Allow: 'GET, HEAD' },
    })

  const target = new URL('/chat', 'https://tanstack.com')
  const chatPath =
    source.pathname === '/chat' || source.pathname.startsWith('/chat/')
  const shortPath =
    /^\/(?:w|p|project)(?:\/|$)/.test(source.pathname) ||
    ['/shared', '/charts', '/new-project'].includes(source.pathname)
  if (source.pathname === '/' || chatPath || shortPath) {
    if (chatPath || shortPath)
      target.pathname = chatPath ? source.pathname : `/chat${source.pathname}`
    const navigation = validateWorkspaceSearch(
      parseSearchWith(JSON.parse)(source.search),
    )
    const defaults: Record<string, unknown> = defaultWorkspaceSearch
    target.search = stringifySearchWith(JSON.stringify)(
      Object.fromEntries(
        Object.entries(navigation).filter(
          ([key, value]) => value !== undefined && value !== defaults[key],
        ),
      ),
    )
  }
  // An explicit empty fragment prevents a browser from inheriting an unseen
  // source fragment, which could contain an OAuth credential.
  target.hash = '#'
  return new Response(null, {
    status: 302,
    headers: { ...headers, Location: target.href },
  })
}
