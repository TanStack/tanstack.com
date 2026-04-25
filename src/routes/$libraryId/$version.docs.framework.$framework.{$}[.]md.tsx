import { findLibrary, getBranch } from '~/libraries'
import { loadDocs } from '~/utils/docs'
import { notFound, createFileRoute } from '@tanstack/react-router'
import { filterFrameworkContent } from '~/utils/markdown/filterFrameworkContent'
import { getPackageManager } from '~/utils/markdown/installCommand'

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
        const url = new URL(request.url)
        const pm = getPackageManager(url.searchParams.get('pm'))
        const keepMarkers = url.searchParams.get('keep_markers') === 'true'

        const { libraryId, version, framework, _splat: docsPath } = params
        const library = findLibrary(libraryId)

        if (!library) {
          throw notFound()
        }

        const root = library.docsRoot || 'docs'

        const doc = await loadDocs({
          repo: library.repo,
          branch: getBranch(library, version),
          docsRoot: root,
          docsPath: `framework/${framework}/${docsPath}`,
        })

        // Filter framework-specific content using framework from URL path
        const filteredContent = filterFrameworkContent(doc.content, {
          framework,
          packageManager: pm,
          keepMarkers,
        })

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
