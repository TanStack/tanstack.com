import { createFileRoute, notFound } from '@tanstack/react-router'
import { getBranch, getLibrary, type LibraryId } from '~/libraries'
import { isDocsNotFoundError } from '~/utils/docs-errors'
import { loadDocs } from '~/utils/docs'
import { filterFrameworkContent } from '~/utils/markdown/filterFrameworkContent'
import { getPackageManager } from '~/utils/markdown/installCommand'

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
        const url = new URL(request.url)
        const framework = url.searchParams.get('framework')
        const pm = getPackageManager(url.searchParams.get('pm'))
        const keepMarkers = url.searchParams.get('keep_markers') === 'true'

        const { libraryId, version, _splat: docsPath } = params
        const library = getLibrary(libraryId as LibraryId)
        const root = library.docsRoot || 'docs'

        let doc

        try {
          doc = await loadDocs({
            repo: library.repo,
            branch: getBranch(library, version),
            docsRoot: root,
            docsPath,
          })
        } catch (error) {
          if (isDocsNotFoundError(error)) {
            throw notFound()
          }

          throw error
        }

        // Filter framework-specific content only if framework is explicitly specified
        const filteredContent = framework
          ? filterFrameworkContent(doc.content, {
              framework,
              packageManager: pm,
              keepMarkers,
            })
          : doc.content

        const markdownContent = `# ${doc.title}\n${filteredContent}`
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
