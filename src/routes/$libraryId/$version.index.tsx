import {
  useMatch,
  Link,
  notFound,
  createFileRoute,
} from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { seo } from '~/utils/seo'

import { Button } from '~/ui'
import { ConfigSchema } from '~/utils/config'
import { landingComponents } from './$version'

export const Route = createFileRoute('/$libraryId/$version/')({
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    return {
      meta: seo({
        title: library.name,
        description: library.description,
        noindex: library.visible === false,
      }),
    }
  },
  // Stats load via Suspense in OpenSourceStats — no need to block the route loader
  component: LibraryVersionIndex,
})

function LibraryVersionIndex() {
  const { libraryId, version } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }
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
      <LandingComponent />
    </DocsLayout>
  )
}
