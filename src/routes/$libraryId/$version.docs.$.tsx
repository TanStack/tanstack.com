import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { isDocsNotFoundError } from '~/utils/docs-errors'
import { loadDocsPage, resolveDocsRedirect } from '~/utils/docs'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import type { ConfigSchema } from '~/utils/config'
import { docsContentNegotiationVaryHeader } from '~/utils/http'
import {
  notFound,
  redirect,
  useLocation,
  useMatch,
  isNotFound,
  createFileRoute,
} from '@tanstack/react-router'

export const Route = createFileRoute('/$libraryId/$version/docs/$')({
  staleTime: 1000 * 60 * 5,
  loader: async (ctx) => {
    const { _splat: docsPath, version, libraryId } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    const branch = getBranch(library, version)
    const docsRoot = library.docsRoot || 'docs'

    try {
      return await loadDocsPage({
        repo: library.repo,
        branch,
        docsRoot,
        docsPath: docsPath ?? '',
      })
    } catch (error) {
      const isNotFoundError =
        isDocsNotFoundError(error) ||
        isNotFound(error) ||
        (error && typeof error === 'object' && 'isNotFound' in error)

      if (isNotFoundError) {
        const redirectPath = await resolveDocsRedirect({
          repo: library.repo,
          branch,
          docsRoot,
          docsPaths: docsPath ? [docsPath] : [],
        })

        if (redirectPath !== null) {
          throw redirect({
            href: `/${libraryId}/${version}/docs${redirectPath ? `/${redirectPath}` : ''}`,
            statusCode: 308,
          })
        }

        throw notFound()
      }

      throw error
    }
  },
  head: ({ loaderData, params }) => {
    const { libraryId } = params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    return {
      meta: seo({
        title: `${loaderData?.title} | ${library.name} Docs`,
        description: loaderData?.description,
        noindex: library.visible === false,
      }),
    }
  },
  component: Docs,
  headers: ({ params }) => {
    const { version, libraryId } = params
    const library = findLibrary(libraryId)

    const isLatestVersion =
      library &&
      (version === 'latest' ||
        version === library.latestVersion ||
        version === library.latestBranch)

    if (isLatestVersion) {
      return {
        'cache-control': 'public, max-age=60, must-revalidate',
        'cdn-cache-control':
          'max-age=600, stale-while-revalidate=3600, durable',
        vary: docsContentNegotiationVaryHeader,
      }
    } else {
      return {
        'cache-control': 'public, max-age=3600, must-revalidate',
        'cdn-cache-control':
          'max-age=86400, stale-while-revalidate=604800, durable',
        vary: docsContentNegotiationVaryHeader,
      }
    }
  },
})

function Docs() {
  const { version, libraryId, _splat } = Route.useParams()
  const { contentRsc, filePath, headings, title } = Route.useLoaderData()
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData as { config: ConfigSchema }
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const location = useLocation()

  return (
    <DocContainer>
      <Doc
        title={title}
        contentRsc={contentRsc}
        repo={library.repo}
        branch={branch}
        filePath={filePath}
        headings={headings}
        colorFrom={library.colorFrom}
        colorTo={library.colorTo}
        textColor={library.textColor}
        shouldRenderToc
        libraryId={libraryId}
        libraryVersion={version === 'latest' ? library.latestVersion : version}
        pagePath={location.pathname}
        config={config}
      />
    </DocContainer>
  )
}
