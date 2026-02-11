import { createFileRoute } from '@tanstack/react-router'
import { getBranch, getLibrary, type LibraryId } from '~/libraries'
import { loadDocs } from '~/utils/docs'

export const Route = createFileRoute('/$libraryId/$version/docs/{$}.md')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { libraryId: string; version: string; _splat: string }
      }) => {
        const _url = new URL(request.url)

        const { libraryId, version, _splat: docsPath } = params
        const library = getLibrary(libraryId as LibraryId)
        const root = library.docsRoot || 'docs'

        const doc = await loadDocs({
          repo: library.repo,
          branch: getBranch(library, version),
          docsPath: `${root}/${docsPath}`,
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
