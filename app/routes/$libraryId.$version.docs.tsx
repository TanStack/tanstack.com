import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getBranch, getLibrary } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'
import { seo } from '~/utils/seo'
import background from '~/images/background.jpg'

export const Route = createFileRoute('/$libraryId/$version/docs')({
  loader: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = getLibrary(libraryId)
    const branch = getBranch(library, version)
    const config = await getTanstackDocsConfig({
      data: {
        repo: library.repo,
        branch,
      },
    })

    return {
      config,
    }
  },
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = getLibrary(libraryId)

    return {
      meta: seo({
        title: `${library.name} Docs`,
      }),
    }
  },
  component: DocsRoute,
})

function DocsRoute() {
  const { libraryId, version } = Route.useParams()
  const library = getLibrary(libraryId)
  const { config } = Route.useLoaderData()

  return (
    <DocsLayout
      name={library.name.replace('TanStack ', '')}
      version={version === 'latest' ? library.latestVersion : version!}
      colorFrom={library.colorFrom}
      colorTo={library.colorTo}
      textColor={library.textColor}
      config={config}
      frameworks={library.frameworks}
      versions={library.availableVersions}
      repo={library.repo}
    >
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none blur-md"
        style={{
          backgroundImage: `url(${background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <Outlet />
    </DocsLayout>
  )
}
