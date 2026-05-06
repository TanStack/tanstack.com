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
 * On Netlify preview/branch deploys, `URL` is still the production URL,
 * but `DEPLOY_PRIME_URL` is the deploy's own origin. Prefer that.
 */
function getOgOrigin(): string {
  if (!import.meta.env.SSR) return DEFAULT_SITE_URL
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
