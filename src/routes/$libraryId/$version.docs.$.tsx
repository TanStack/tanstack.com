import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'

export const Route = createFileRoute('/$libraryId/$version/docs/$')({
  staleTime: 1000 * 60 * 5,
  loader: (ctx) => {
    const { _splat: docsPath, version, libraryId } = ctx.params
    const library = getLibrary(libraryId)

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
    const library = getLibrary(libraryId)

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
