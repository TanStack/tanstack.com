import { getRequest } from '@tanstack/react-start/server'
import type { LibraryId } from '~/libraries'
import { canonicalUrl } from './seo'
import {
  MAX_OG_DESCRIPTION_LENGTH,
  MAX_OG_TITLE_LENGTH,
  clampOgText,
} from './og-limits'

const DEFAULT_SITE_URL = 'https://tanstack.com'

type OgImageOptions = {
  title?: string | null
  description?: string | null
}

/**
 * Absolute origin to use for og:image URLs.
 *
 * Unlike canonical links (which must always point to production),
 * og:image URLs MUST be reachable on the same deploy that emitted them
 * — social-card validators fetch the URL from the meta tag verbatim.
 *
 * The incoming request URL is the source of truth: on a Netlify deploy
 * preview the request hits `deploy-preview-N--tanstack.netlify.app`, so
 * the og:image must point there too. `process.env.DEPLOY_PRIME_URL` and
 * friends turn out to be unreliable inside the bundled SSR function, so
 * we read the origin from the live request instead.
 */
function getOgOrigin(): string {
  if (!import.meta.env.SSR) return DEFAULT_SITE_URL
  try {
    const request = getRequest()
    if (request?.url) return new URL(request.url).origin
  } catch {
    // getRequest() throws if called outside an SSR request context
    // (e.g. build-time prerender). Fall through to the env-var fallback.
  }
  const env = process.env
  const origin =
    env.DEPLOY_PRIME_URL || env.DEPLOY_URL || env.URL || env.SITE_URL
  return (origin ?? DEFAULT_SITE_URL).replace(/\/$/, '')
}

/**
 * Absolute URL for a package-themed OG image.
 * Defaults to the library's name + tagline. Pass a title/description
 * to override (used by docs pages).
 */
export function ogImageUrl(
  libraryId: LibraryId,
  options: OgImageOptions = {},
): string {
  // Clamp client-side to the same limits as the server-side generator so
  // <meta og:image> URLs stay bounded and CDN cache keys stay stable.
  const params = new URLSearchParams()
  if (options.title) {
    params.set('title', clampOgText(options.title, MAX_OG_TITLE_LENGTH))
  }
  if (options.description) {
    params.set(
      'description',
      clampOgText(options.description, MAX_OG_DESCRIPTION_LENGTH),
    )
  }

  const qs = params.toString()
  const path = `/api/og/${libraryId}.png${qs ? `?${qs}` : ''}`

  // On client (which can't happen in head() but guards against misuse),
  // fall through to canonicalUrl which uses the production hostname.
  if (!import.meta.env.SSR) return canonicalUrl(path)

  return `${getOgOrigin()}${path}`
}
