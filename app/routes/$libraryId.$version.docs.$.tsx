import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'

export const Route = createFileRoute('/$libraryId/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version, libraryId } = ctx.params
    const library = getLibrary(libraryId)

    return loadDocs({
      repo: library.repo,
      branch: getBranch(library, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/${library.id}/${version}/docs/overview`,
    })
  },
  meta: ({ loaderData, params }) => {
    const { libraryId } = params
    const library = getLibrary(libraryId)

    return seo({
      title: `${loaderData?.title} | ${library.name} Docs`,
      description: loaderData?.description,
    })
  },
  component: Docs,
})

function Docs() {
  const { version, libraryId } = Route.useParams()
  const { title, content, filePath } = Route.useLoaderData()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={library.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
