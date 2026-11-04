import { getDocsCacheHeaders } from './docs-cache-headers'

// Called after loaders finish, so data-fetching functions cannot overwrite
// the page's cache policy or its document and sidebar invalidation tags.
export function finalizeDocsHtmlHeaders(request: Request, response: Response) {
  if (!response.headers.has('X-Docs-Html')) return response
  const headers = new Headers(response.headers)
  headers.delete('X-Docs-Html')
  if (
    response.status === 200 &&
    response.headers.get('X-Docs-Html') === '1' &&
    !headers.has('set-cookie') &&
    !/no-store|private/i.test(headers.get('cache-control') ?? '')
  ) {
    const [, libraryId, version] = new URL(request.url).pathname.split('/')
    for (const [key, value] of Object.entries(
      getDocsCacheHeaders({ libraryId, version }),
    )) {
      headers.set(key, value)
    }
  } else {
    headers.set('Cache-Control', 'private, no-store')
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
  }
  // Keep complete HTML responses out of every shared cache during profiling.
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store')
  headers.set(
    'Vary',
    [headers.get('Vary'), 'Cookie', 'Authorization'].filter(Boolean).join(', '),
  )
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
