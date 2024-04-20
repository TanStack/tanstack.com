import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'
import { capitalize } from '~/utils/utils'

export const Route = createFileRoute(
  '/$libraryId/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version, libraryId } = ctx.params

    const library = getLibrary(libraryId)

    return loadDocs({
      repo: library.repo,
      branch: getBranch(library, version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/${library.id}/${version}/docs/overview`,
    })
  },
  component: Docs,
  meta: (ctx) => {
    const library = getLibrary(ctx.params.libraryId)
    const tail = `${library.name} ${capitalize(ctx.params.framework)} Docs`

    return seo({
      title: ctx.loaderData?.title ? `${ctx.loaderData.title} | ${tail}` : tail,
      description: ctx.loaderData?.description,
    })
  },
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version, libraryId } = Route.useParams()
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
