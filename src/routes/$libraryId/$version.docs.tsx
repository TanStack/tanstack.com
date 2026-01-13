import { Outlet, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'

const versionRouteApi = getRouteApi('/$libraryId/$version')

export const Route = createFileRoute('/$libraryId/$version/docs')({
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = getLibrary(libraryId)

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
    }
  },
})

function DocsRoute() {
  const { libraryId, version } = Route.useParams()
  const library = getLibrary(libraryId)
  const { config } = versionRouteApi.useLoaderData()

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
