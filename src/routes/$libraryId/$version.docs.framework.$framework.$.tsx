import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch, getLibrary } from '~/libraries'
import { capitalize } from '~/utils/utils'
import { DocContainer } from '~/components/DocContainer'

// Helper function to check if the Accept header prefers markdown
function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false

  const accepts = acceptHeader.split(',').map(type => {
    const [mediaType, ...params] = type.trim().split(';')
    const quality = params.find(p => p.trim().startsWith('q='))
    const q = quality ? parseFloat(quality.split('=')[1]) : 1.0
    return { mediaType: mediaType.toLowerCase(), q }
  })

  const markdownQ = accepts.find(a =>
    a.mediaType === 'text/markdown' || a.mediaType === 'text/plain'
  )?.q || 0

  const htmlQ = accepts.find(a =>
    a.mediaType === 'text/html' || a.mediaType === '*/*'
  )?.q || 0

  return markdownQ > 0 && markdownQ > htmlQ
}

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request, params }) => {
    const acceptHeader = request.headers.get('Accept')

    if (prefersMarkdown(acceptHeader)) {
      const url = new URL(request.url)
      const { libraryId, version, framework, _splat: docsPath } = params
      const library = getLibrary(libraryId)
      const root = library.docsRoot || 'docs'

      const doc = await loadDocs({
        repo: library.repo,
        branch: getBranch(library, version),
        docsPath: `${root}/framework/${framework}/${docsPath}`,
        currentPath: url.pathname,
        redirectPath: `/${library.id}/${version}/docs/overview`,
      })

      const markdownContent = `# ${doc.title}\n${doc.content}`

      return new Response(markdownContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Cdn-Cache-Control': 'max-age=300, stale-while-revalidate=300, durable',
          'Vary': 'Accept',
        },
      })
    }
  },
})

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
  headers: (ctx) => {
    return {
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
      'vary': 'Accept',
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
