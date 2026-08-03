import { createFileRoute, notFound } from '@tanstack/react-router'
import { findLibrary, getBranch } from '~/libraries'
import { buildDocsMarkdownRedirectHref, loadDocsRoute } from '~/utils/docs'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { getContentDispositionHeader } from '~/utils/http-response'
import { filterFrameworkContent } from '~/utils/markdown/filterFrameworkContent'
import { getPackageManager } from '~/utils/markdown/installCommand'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/{$}.md',
)({
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
        const branch = getBranch(library, version)
        const result = await loadDocsRoute({
          repo: library.repo,
          branch,
          docsRoot: root,
          docsPath,
          defaultDocs: library.defaultDocs ?? 'overview',
          frameworks: library.frameworks,
          redirectFromPaths: docsPath ? [docsPath] : [],
        })

        if (result.type === 'redirect') {
          return Response.redirect(
            buildDocsMarkdownRedirectHref({
              requestUrl: request.url,
              docsPath: result.docsPath,
              libraryId,
              version,
            }),
            308,
          )
        }

        if (result.type === 'not-found') {
          throw notFound()
        }

        const doc = result.doc

        // Filter framework-specific content only if framework is explicitly specified
        const filteredContent = framework
          ? filterFrameworkContent(doc.content, {
              framework,
              packageManager: pm,
              keepMarkers,
            })
          : doc.content

        const markdownContent = `# ${doc.title}\n${filteredContent}`
        const filename = `${result.docsPath || 'file'}.md`

        return new Response(markdownContent, {
          headers: {
            ...cacheHeaders,
            'Content-Type': 'text/markdown',
            'Content-Disposition': getContentDispositionHeader(
              'inline',
              filename,
              'file.md',
            ),
          },
        })
      },
    },
  },
})
