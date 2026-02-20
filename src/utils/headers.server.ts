import {
  setResponseHeaders as _setResponseHeaders,
  setResponseHeader as _setResponseHeader,
} from '@tanstack/react-start/server'

export const setResponseHeaders = _setResponseHeaders
export const setResponseHeader = _setResponseHeader

export function setCacheHeaders(opts?: {
  maxAge?: number
  cdnMaxAge?: number
  staleWhileRevalidate?: number
}) {
  const { maxAge = 0, cdnMaxAge = 300, staleWhileRevalidate = 300 } = opts ?? {}

  setResponseHeaders(
    new Headers({
      'Cache-Control': `public, max-age=${maxAge}, must-revalidate`,
      'Netlify-CDN-Cache-Control': `public, max-age=${cdnMaxAge}, durable, stale-while-revalidate=${staleWhileRevalidate}`,
    }),
  )
}
