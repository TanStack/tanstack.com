import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import {
  notFound,
  createFileRoute,
  useLocation,
  getRouteApi,
} from '@tanstack/react-router'

const docsRouteApi = getRouteApi('/$libraryId/$version/docs')

export const Route = createFileRoute('/$libraryId/$version/docs/$')({
  staleTime: 1000 * 60 * 5,
  loader: (ctx) => {
    const { _splat: docsPath, version, libraryId } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    return loadDocs({
      repo: library.repo,
      branch: getBranch(library, version),
      docsPath: `${library.docsRoot || 'docs'}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/${library.id}/${version}/docs/overview`,
    })
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
        vary: 'Accept-Encoding',
      }
    } else {
      return {
        'cache-control': 'public, max-age=3600, must-revalidate',
        'cdn-cache-control':
          'max-age=86400, stale-while-revalidate=604800, durable',
        vary: 'Accept-Encoding',
      }
    }
  },
})

function Docs() {
  const { version, libraryId, _splat } = Route.useParams()
  const { title, content, filePath } = Route.useLoaderData()
  const { config } = docsRouteApi.useLoaderData()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const location = useLocation()

  return (
    <DocContainer>
      <Doc
        title={title}
        content={content}
        repo={library.repo}
        branch={branch}
        filePath={filePath}
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
