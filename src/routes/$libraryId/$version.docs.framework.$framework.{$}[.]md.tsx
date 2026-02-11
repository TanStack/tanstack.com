import { findLibrary, getBranch } from '~/libraries'
import { loadDocs } from '~/utils/docs'
import { notFound, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/$libraryId/$version/docs/framework/$framework/{$}.md',
)({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: {
          libraryId: string
          version: string
          framework: string
          _splat: string
        }
      }) => {
        const _url = new URL(request.url)

        const { libraryId, version, framework, _splat: docsPath } = params
        const library = findLibrary(libraryId)

        if (!library) {
          throw notFound()
        }

        const root = library.docsRoot || 'docs'

        const doc = await loadDocs({
          repo: library.repo,
          branch: getBranch(library, version),
          docsPath: `${root}/framework/${framework}/${docsPath}`,
        })

        const markdownContent = `# ${doc.title}\n${doc.content}`
        const filename = (docsPath || 'file').split('/').join('-')

        return new Response(markdownContent, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': `inline; filename="${filename}.md"`,
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Cdn-Cache-Control':
              'max-age=300, stale-while-revalidate=300, durable',
          },
        })
      },
    },
  },
})
