import { createFileRoute, notFound } from '@tanstack/react-router'
import { findLibrary, getBranch } from '~/libraries'
import { loadDocs } from '~/utils/docs'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
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
        const library = findLibrary(libraryId)

        if (!library) {
          throw notFound()
        }

        const root = library.docsRoot || 'docs'
        const cacheHeaders = getDocsCacheHeaders({ libraryId, version })

        const doc = await loadDocs({
          repo: library.repo,
          branch: getBranch(library, version),
          docsRoot: root,
          docsPath,
        })

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
            ...cacheHeaders,
            'Content-Type': 'text/markdown',
            'Content-Disposition': `inline; filename="${filename}.md"`,
          },
        })
      },
    },
  },
})
