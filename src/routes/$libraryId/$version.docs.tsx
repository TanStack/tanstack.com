import {
  Outlet,
  useMatch,
  notFound,
  createFileRoute,
} from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { findLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import type { ConfigSchema } from '~/utils/config'
import { docsContentNegotiationVaryHeader } from '~/utils/http'

export const Route = createFileRoute('/$libraryId/$version/docs')({
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    return {
      meta: seo({
        title: `${library.name} Docs`,
        noindex: library.visible === false,
      }),
    }
  },
  component: DocsRoute,
  headers: () => {
    return {
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
      vary: docsContentNegotiationVaryHeader,
    }
  },
})

function DocsRoute() {
  const { libraryId, version } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData as { config: ConfigSchema }

  if (!config) {
    throw notFound()
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
    >
      <Outlet />
    </DocsLayout>
  )
}
