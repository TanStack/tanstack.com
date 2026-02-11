import * as React from 'react'
import {
  useMatch,
  redirect,
  Link,
  createFileRoute,
} from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { seo } from '~/utils/seo'
import { ossStatsQuery } from '~/queries/stats'
import { Button } from '~/ui'
import { ConfigSchema } from '~/utils/config'

// Lazy-loaded landing components for each library
const landingComponents: Partial<
  Record<LibraryId, React.LazyExoticComponent<React.ComponentType>>
> = {
  query: React.lazy(() => import('~/components/landing/QueryLanding')),
  router: React.lazy(() => import('~/components/landing/RouterLanding')),
  table: React.lazy(() => import('~/components/landing/TableLanding')),
  form: React.lazy(() => import('~/components/landing/FormLanding')),
  start: React.lazy(() => import('~/components/landing/StartLanding')),
  store: React.lazy(() => import('~/components/landing/StoreLanding')),
  virtual: React.lazy(() => import('~/components/landing/VirtualLanding')),
  ranger: React.lazy(() => import('~/components/landing/RangerLanding')),
  pacer: React.lazy(() => import('~/components/landing/PacerLanding')),
  config: React.lazy(() => import('~/components/landing/ConfigLanding')),
  db: React.lazy(() => import('~/components/landing/DbLanding')),
  ai: React.lazy(() => import('~/components/landing/AiLanding')),
  devtools: React.lazy(() => import('~/components/landing/DevtoolsLanding')),
  cli: React.lazy(() => import('~/components/landing/CliLanding')),
}

export const Route = createFileRoute('/$libraryId/$version/')({
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = getLibrary(libraryId)

    return {
      meta: seo({
        title: library.name,
        description: library.description,
        noindex: library.visible === false,
      }),
    }
  },
  beforeLoad: ({ params }) => {
    const { libraryId, version } = params
    // Libraries without landing pages redirect directly to docs
    if (!landingComponents[libraryId as LibraryId]) {
      throw redirect({
        to: '/$libraryId/$version/docs',
        params: { libraryId, version } as never,
      })
    }
    return undefined as never
  },
  // @ts-expect-error - not sure why this is erroring
  loader: async ({ params, context: { queryClient } }) => {
    const { libraryId } = params
    const library = getLibrary(libraryId)
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
  component: LibraryVersionIndex,
})

function LibraryVersionIndex() {
  const { libraryId, version } = Route.useParams()
  const library = getLibrary(libraryId)
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData as { config: ConfigSchema }

  const LandingComponent = landingComponents[libraryId as LibraryId]

  if (!LandingComponent) {
    return (
      <DocsLayout
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
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <h1 className="text-2xl font-bold">{library.name}</h1>
          <p className="text-gray-600">{library.description}</p>
          <Button
            as={Link}
            to="/$libraryId/$version/docs"
            params={{ libraryId, version } as never}
          >
            View Documentation
          </Button>
        </div>
      </DocsLayout>
    )
  }

  return (
    <DocsLayout
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
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500" />
          </div>
        }
      >
        <LandingComponent />
      </React.Suspense>
    </DocsLayout>
  )
}
