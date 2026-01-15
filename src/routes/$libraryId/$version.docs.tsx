import { Outlet, createFileRoute, useMatch } from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'

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
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const acceptHeader = request.headers.get('Accept') || ''

        // Redirect to markdown version if AI/LLM requests text/markdown
        if (acceptHeader.includes('text/markdown')) {
          const url = new URL(request.url)
          return new Response(null, {
            status: 303,
            headers: {
              Location: `${url.pathname}.md`,
            },
          })
        }

        // Return undefined to continue with normal route handling
        return undefined
      },
    },
  },
})

function DocsRoute() {
  const { libraryId, version } = Route.useParams()
  const library = getLibrary(libraryId)
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData

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
