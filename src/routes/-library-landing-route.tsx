import type { ReactNode } from 'react'
import { Link, redirect } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { Scarf } from '~/components/Scarf'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'
import type { ConfigSchema } from '~/utils/config'
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

export function LibraryLandingLayout({
  children,
  config,
  libraryId,
  version,
}: {
  children: ReactNode
  config: ConfigSchema
  libraryId: LandingLibraryId
  version: string
}) {
  const library = getLibrary(libraryId)

  return (
    <>
      <DocsLayout
        libraryId={library.id}
        name={library.name.replace('TanStack ', '')}
        version={version === 'latest' ? library.latestVersion : version}
        colorFrom={library.accentColorFrom ?? library.colorFrom}
        colorTo={library.accentColorTo ?? library.colorTo}
        textColor={library.accentTextColor ?? library.textColor ?? ''}
        config={config}
        frameworks={library.frameworks}
        versions={library.availableVersions}
        repo={library.repo}
        isLandingPage
      >
        {children}
      </DocsLayout>
      <RedirectVersionBanner
        version={version}
        latestVersion={library.latestVersion}
      />
      {library.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}

export function LibraryNavbarTitle({
  libraryId,
}: {
  libraryId: LandingLibraryId
  version: string
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
