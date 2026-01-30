import {
  isNotFound,
  redirect,
  useLocation,
  useMatch,
  createFileRoute,
} from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'
import { capitalize } from '~/utils/utils'
import { DocContainer } from '~/components/DocContainer'
import type { ConfigSchema } from '~/utils/config'

export const Route = createFileRoute(
  '/$libraryId/$version/docs/framework/$framework/$',
)({
  staleTime: 1000 * 60 * 5,
  loader: async (ctx) => {
    const { _splat: docsPath, framework, version, libraryId } = ctx.params

    const library = getLibrary(libraryId)

    try {
      return await loadDocs({
        repo: library.repo,
        branch: getBranch(library, version),
        docsPath: `${
          library.docsRoot || 'docs'
        }/framework/${framework}/${docsPath}`,
      })
    } catch (error) {
      // If doc not found, redirect to framework docs root instead of showing 404
      // This handles cases like switching frameworks where the same doc path doesn't exist
      // Check both isNotFound() and the serialized form from server functions
      const isNotFoundError =
        isNotFound(error) ||
        (error && typeof error === 'object' && 'isNotFound' in error)
      if (isNotFoundError) {
        throw redirect({
          to: '/$libraryId/$version/docs/framework/$framework',
          params: { libraryId, version, framework },
        })
      }
      throw error
    }
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
        noindex: library.visible === false,
      }),
    }
  },
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData as { config: ConfigSchema }
  const { version, libraryId, framework } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const location = useLocation()

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
        textColor={library.textColor}
        shouldRenderToc
        libraryId={libraryId}
        libraryVersion={version === 'latest' ? library.latestVersion : version}
        pagePath={location.pathname}
        config={config}
        framework={framework}
      />
    </DocContainer>
  )
}
