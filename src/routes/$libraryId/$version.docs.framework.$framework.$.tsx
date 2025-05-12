import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'
import { capitalize } from '~/utils/utils'
import { DocContainer } from '~/components/DocContainer'

export const Route = createFileRoute({
  staleTime: 1000 * 60 * 5,
  loader: (ctx) => {
    const { _splat: docsPath, framework, version, libraryId } = ctx.params

    const library = getLibrary(libraryId)

    return loadDocs({
      repo: library.repo,
      branch: getBranch(library, version),
      docsPath: `${
        library.docsRoot || 'docs'
      }/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/${library.id}/${version}/docs/overview`,
    })
  },
  component: Docs,
  head: (ctx) => {
    const library = getLibrary(ctx.params.libraryId)
    const tail = `${library.name} ${capitalize(ctx.params.framework)} Docs`

    return {
      meta: seo({
        title: ctx.loaderData?.title
          ? `${ctx.loaderData.title} | ${tail}`
          : tail,
        description: ctx.loaderData?.description,
      }),
    }
  },
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  return (
    <DocContainer>
      <Doc
        key={filePath}
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
