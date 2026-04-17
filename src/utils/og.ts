import type { LibraryId } from '~/libraries'
import { canonicalUrl } from './seo'

type OgImageOptions = {
  title?: string | null
  description?: string | null
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
  const params = new URLSearchParams()
  if (options.title) params.set('title', options.title)
  if (options.description) params.set('description', options.description)

  const qs = params.toString()
  const path = `/api/og/${libraryId}.png${qs ? `?${qs}` : ''}`
  return canonicalUrl(path)
}
