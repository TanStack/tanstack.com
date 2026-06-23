import { createFileRoute, notFound } from '@tanstack/react-router'
import { findLibrary, getBranch } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { generateLibraryDocsIndexMarkdown } from '~/utils/llms'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/index.md',
)({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        params: { libraryId: string; version: string }
      }) => {
        const { libraryId, version } = params
        const library = findLibrary(libraryId)

        if (!library) {
          throw notFound()
        }

        const docsRoot = library.docsRoot || 'docs'
        const config = await getTanstackDocsConfig({
          data: {
            repo: library.repo,
            branch: getBranch(library, version),
            docsRoot,
          },
        })

        return new Response(
          generateLibraryDocsIndexMarkdown({
            config,
            library,
            version,
          }),
          {
            headers: {
              ...getDocsCacheHeaders({ libraryId, version }),
              'Content-Type': 'text/markdown; charset=utf-8',
              'Content-Disposition': 'inline; filename="index.md"',
            },
          },
        )
      },
    },
  },
})
