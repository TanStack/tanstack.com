import type { ComponentType, ReactNode } from 'react'
import { getRouteApi, Link, notFound, redirect } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { Scarf } from '~/components/Scarf'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'
import { seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'

export type LandingComponentProps = {
  landingCodeExampleRsc?: ReactNode
}

type LandingComponent = ComponentType<LandingComponentProps>

type StaticLandingRoutePath =
  | '/ai/$version/'
  | '/cli/$version/'
  | '/config/$version/'
  | '/db/$version/'
  | '/devtools/$version/'
  | '/form/$version/'
  | '/hotkeys/$version/'
  | '/intent/$version/'
  | '/pacer/$version/'
  | '/query/$version/'
  | '/ranger/$version/'
  | '/router/$version/'
  | '/start/$version/'
  | '/store/$version/'
  | '/table/$version/'
  | '/virtual/$version/'

function getLibraryOrThrow(libraryId: string) {
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }

  return library
}

export function validateLibraryVersion(
  libraryId: string,
  version: string | undefined,
  onInvalidVersion: () => never,
) {
  const library = getLibraryOrThrow(libraryId)

  if (!library.availableVersions.concat('latest').includes(version!)) {
    onInvalidVersion()
  }

  return library
}

export async function loadLibraryConfig(libraryId: LibraryId, version: string) {
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  return getTanstackDocsConfig({
    data: {
      repo: library.repo,
      branch,
      docsRoot: library.docsRoot || 'docs',
    },
  })
}

function LibraryNavbarTitle<TId extends StaticLandingRoutePath>({
  libraryId,
  routePath,
}: {
  libraryId: LibraryId
  routePath: TId
}) {
  const routeApi = getRouteApi(routePath)
  const { version } = routeApi.useParams()
  const library = getLibrary(libraryId)

  const libraryName = library.name.replace('TanStack ', '')
  const resolvedVersion =
    version === 'latest'
      ? library.latestVersion
      : (version ?? library.latestVersion)
  const gradientText = `inline-block text-transparent bg-clip-text bg-linear-to-r ${library.colorFrom} ${library.colorTo}`

  return (
    <Link
      to="/$libraryId"
      params={{ libraryId }}
      className="relative whitespace-nowrap"
    >
      <span className={gradientText}>{libraryName}</span>{' '}
      <span className="text-sm absolute right-0 top-0 font-normal normal-case">
        {resolvedVersion}
      </span>
      <span className="text-sm opacity-0 normal-case">{resolvedVersion}</span>
    </Link>
  )
}

export function createLibraryLandingPage<TId extends StaticLandingRoutePath>(
  routePath: TId,
  libraryId: LibraryId,
  LandingComponent: LandingComponent,
) {
  const library = getLibrary(libraryId)
  const routeApi = getRouteApi(routePath)

  function LibraryLandingPage() {
    const { version } = routeApi.useParams()
    const { config, landingCodeExampleRsc } = routeApi.useLoaderData()

    if (!config) {
      throw notFound()
    }

    return (
      <>
        <DocsLayout
          libraryId={libraryId}
          name={library.name.replace('TanStack ', '')}
          version={version === 'latest' ? library.latestVersion : version!}
          colorFrom={library.accentColorFrom ?? library.colorFrom}
          colorTo={library.accentColorTo ?? library.colorTo}
          textColor={library.accentTextColor ?? library.textColor ?? ''}
          config={config}
          frameworks={library.frameworks}
          versions={library.availableVersions}
          repo={library.repo}
          isLandingPage
        >
          <LandingComponent landingCodeExampleRsc={landingCodeExampleRsc} />
        </DocsLayout>
        <RedirectVersionBanner
          version={version!}
          latestVersion={library.latestVersion}
        />
        {library.scarfId ? <Scarf id={library.scarfId} /> : null}
      </>
    )
  }

  return {
    staleTime: 1000 * 60 * 5,
    beforeLoad: (ctx: {
      location: { href: string }
      params: { version: string }
    }) => {
      library.handleRedirects?.(ctx.location.href)

      validateLibraryVersion(libraryId, ctx.params.version, () => {
        throw redirect({ href: `/${libraryId}/latest` })
      })
    },
    loader: async ({ params }: { params: { version: string } }) => {
      const [config, landingCodeExample] = await Promise.all([
        loadLibraryConfig(libraryId, params.version),
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
    },
    head: () => ({
      meta: seo({
        title: library.name,
        description: library.description,
        image: ogImageUrl(library.id),
        noindex: library.visible === false,
      }),
    }),
    staticData: {
      Title: () => (
        <LibraryNavbarTitle libraryId={libraryId} routePath={routePath} />
      ),
    },
    component: LibraryLandingPage,
  }
}
