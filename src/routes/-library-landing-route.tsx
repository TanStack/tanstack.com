import { Link, redirect } from '@tanstack/react-router'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'
import { ogImageUrl } from '~/utils/og'
import { seo } from '~/utils/seo'
import { stackBlitzEmbedHeaders } from '~/utils/stackblitz-embed'
import { loadLibraryConfig, validateLibraryVersion } from './-library-landing'
import type { LandingLibraryId } from './-library-landing'

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
    throw redirect({ href: `/${libraryId}/latest` })
  })

  library.handleRedirects?.(href)
}

export async function loadLibraryLandingRouteData(
  libraryId: LandingLibraryId,
  version: string,
) {
  const [config, landingCodeExample] = await Promise.all([
    loadLibraryConfig(libraryId, version),
    fetchLandingCodeExample({
      data: {
        libraryId,
      },
    }),
  ])

  return {
    config,
    landingCodeExampleRsc: landingCodeExample?.contentRsc ?? null,
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

export function LibraryNavbarTitle({
  libraryId,
}: {
  libraryId: LandingLibraryId
}) {
  const library = getLibrary(libraryId)
  const libraryName = library.name.replace('TanStack ', '')
  const gradientText = `inline-block text-transparent bg-clip-text bg-linear-to-r ${library.colorFrom} ${library.colorTo}`

  return (
    <Link
      to="/$libraryId"
      params={{ libraryId: library.id }}
      className="whitespace-nowrap"
    >
      <span className={gradientText}>{libraryName}</span>
    </Link>
  )
}
