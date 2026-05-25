import { findLibrary, getBranch } from '~/libraries'
import { docsContentNegotiationVaryHeader } from './http'

const latestDocsCdnCacheControl =
  'max-age=60, stale-while-revalidate=60, durable'
const versionedDocsCdnCacheControl =
  'max-age=300, stale-while-revalidate=300, durable'

export function getDocsCacheHeaders({
  libraryId,
  version,
}: {
  libraryId: string
  version: string
}) {
  const library = findLibrary(libraryId)
  const branch = library ? getBranch(library, version) : null
  const isLatestVersion =
    library &&
    (version === 'latest' ||
      version === library.latestVersion ||
      version === library.latestBranch)
  const cacheTags = library
    ? ['docs:all', `docs:${library.id}`, `docs:${library.id}:branch:${branch}`]
    : ['docs:all']

  return {
    'Cache-Control': isLatestVersion
      ? 'public, max-age=60, must-revalidate'
      : 'public, max-age=300, must-revalidate',
    'CDN-Cache-Control': isLatestVersion
      ? latestDocsCdnCacheControl
      : versionedDocsCdnCacheControl,
    'Netlify-Cache-Tag': cacheTags.join(', '),
    Vary: docsContentNegotiationVaryHeader,
  }
}
