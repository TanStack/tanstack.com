// Server-rendered pages carry the visitor's own state: the consent banner and
// the choices read from their cookie. Loaders and server functions set
// Cache-Control for the whole response, and some of them (OSS stats, docs)
// make it public, which let browsers reuse an HTML page made for an earlier
// request. Pages stay out of shared caches, and browsers revalidate them.
export function applyHtmlCacheHeaders(headers: Headers) {
  if (!headers.get('Content-Type')?.startsWith('text/html')) return

  headers.set('Cache-Control', 'private, no-cache')
  headers.delete('Cloudflare-CDN-Cache-Control')
}
