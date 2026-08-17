import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { ossStatsQuery, recentDownloadsQuery } from '~/queries/stats'
import { ogImageUrl } from '~/utils/og'
import { seo } from '~/utils/seo'
import { stackBlitzEmbedHeaders } from '~/utils/stackblitz-embed'
import { validateLibraryVersion } from './-library-landing'
import type { LandingLibraryId } from './-library-landing'
import type { ConfigSchema } from '~/utils/config'

const stackBlitzLandingLibraryIds = new Set<LibraryId>([
  'form',
  'query',
  'ranger',
  'router',
  'table',
  'virtual',
])

export const libraryLandingStaleTime = 1000 * 60 * 5

export function beforeLoadLibraryLanding(
  libraryId: LandingLibraryId,
  version: string | undefined,
  href: string,
) {
  const library = validateLibraryVersion(libraryId, version, () => {
    throw redirect({ href: `/${libraryId}/latest`, statusCode: 308 })
  })

  library.handleRedirects?.(href)
}

export async function loadLibraryLandingRouteData(
  libraryId: LandingLibraryId,
  version: string,
  queryClient: QueryClient,
): Promise<{
  config: ConfigSchema
}> {
  const library = getLibrary(libraryId)
  const configPromise = queryClient.ensureQueryData(
    docsConfigQueryOptions(libraryId, version),
  )
  const statsPromise =
    library.statsAvailable === false
      ? Promise.resolve()
      : Promise.all([
          queryClient.ensureQueryData(ossStatsQuery({ library })),
          queryClient.ensureQueryData(recentDownloadsQuery({ library })),
        ]).then(() => undefined)
  const [config] = await Promise.all([configPromise, statsPromise])

  return {
    config,
  }
}

export function getLibraryLandingHead(libraryId: LandingLibraryId) {
  const library = getLibrary(libraryId)

  return {
    meta: seo({
      title: library.name,
      description: library.description,
      image: ogImageUrl(library.id),
      noindex: library.visible === false,
    }),
  }
}

export function getLibraryLandingHeaders(libraryId: LandingLibraryId) {
  return stackBlitzLandingLibraryIds.has(libraryId)
    ? stackBlitzEmbedHeaders
    : {}
}
