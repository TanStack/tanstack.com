import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import {
  loadDocs,
  prefersMarkdown,
  createMarkdownResponse,
} from '~/utils/docs'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import { notFound } from '@tanstack/react-router'

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request, params }) => {
    const acceptHeader = request.headers.get('Accept')

    if (prefersMarkdown(acceptHeader)) {
      const url = new URL(request.url)
      const { libraryId, version, _splat: docsPath } = params
      const library = getLibrary(libraryId)
      const root = library.docsRoot || 'docs'

      const doc = await loadDocs({
        repo: library.repo,
        branch: getBranch(library, version),
        docsPath: `${root}/${docsPath}`,
        currentPath: url.pathname,
        redirectPath: `/${library.id}/${version}/docs/overview`,
      })

      return createMarkdownResponse(doc.title, doc.content)
    }
  },
})

export const Route = createFileRoute({
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
  headers: (ctx) => {
    return {
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
      'vary': 'Accept',
    }
  },
})

function Docs() {
  const { version, libraryId } = Route.useParams()
  const { title, content, filePath } = Route.useLoaderData()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

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
        shouldRenderToc
      />
    </DocContainer>
  )
}
