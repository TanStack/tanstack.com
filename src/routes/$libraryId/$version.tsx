import {
  Outlet,
  redirect,
  notFound,
  createFileRoute,
  lazyRouteComponent,
} from '@tanstack/react-router'
import type { AsyncRouteComponent } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { findLibrary, getBranch } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'

export type LandingComponentProps = {
  landingCodeExampleRsc?: ReactNode
}

export const landingComponents: Partial<
  Record<LibraryId, AsyncRouteComponent<LandingComponentProps>>
> = {
  query: lazyRouteComponent(() => import('~/components/landing/QueryLanding')),
  router: lazyRouteComponent(
    () => import('~/components/landing/RouterLanding'),
  ),
  table: lazyRouteComponent(() => import('~/components/landing/TableLanding')),
  form: lazyRouteComponent(() => import('~/components/landing/FormLanding')),
  start: lazyRouteComponent(() => import('~/components/landing/StartLanding')),
  store: lazyRouteComponent(() => import('~/components/landing/StoreLanding')),
  virtual: lazyRouteComponent(
    () => import('~/components/landing/VirtualLanding'),
  ),
  ranger: lazyRouteComponent(
    () => import('~/components/landing/RangerLanding'),
  ),
  pacer: lazyRouteComponent(() => import('~/components/landing/PacerLanding')),
  hotkeys: lazyRouteComponent(
    () => import('~/components/landing/HotkeysLanding'),
  ),
  config: lazyRouteComponent(
    () => import('~/components/landing/ConfigLanding'),
  ),
  db: lazyRouteComponent(() => import('~/components/landing/DbLanding')),
  ai: lazyRouteComponent(() => import('~/components/landing/AiLanding')),
  devtools: lazyRouteComponent(
    () => import('~/components/landing/DevtoolsLanding'),
  ),
  cli: lazyRouteComponent(() => import('~/components/landing/CliLanding')),
  intent: lazyRouteComponent(
    () => import('~/components/landing/IntentLanding'),
  ),
}

export const Route = createFileRoute('/$libraryId/$version')({
  staleTime: 1000 * 60 * 5,
  beforeLoad: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    library.handleRedirects?.(ctx.location.href)

    if (!library.availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: { libraryId, version: 'latest' } as never,
      })
    }

    if (!ctx.location.pathname.includes('/docs')) {
      await landingComponents[libraryId as LibraryId]?.preload?.()
    }
  },
  loader: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    const branch = getBranch(library, version)
    const config = await getTanstackDocsConfig({
      data: {
        repo: library.repo,
        branch,
        docsRoot: library.docsRoot || 'docs',
      },
    })

    const landingCodeExample = ctx.location.pathname.includes('/docs')
      ? null
      : await fetchLandingCodeExample({
          data: {
            libraryId,
          },
        })

    return {
      config,
      landingCodeExampleRsc: landingCodeExample?.contentRsc ?? null,
    }
  },
  component: RouteForm,
})

function RouteForm() {
  const { libraryId, version } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }

  return (
    <>
      <Outlet />
      <RedirectVersionBanner
        version={version!}
        latestVersion={library.latestVersion}
      />
    </>
  )
}
