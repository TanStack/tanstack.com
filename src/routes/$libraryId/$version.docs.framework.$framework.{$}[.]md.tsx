import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { loadDocs } from '~/utils/docs'
import { notFound } from '@tanstack/react-router'

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request, params }) => {
    const url = new URL(request.url)

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
      currentPath: url.pathname,
      redirectPath: `/${library.id}/${version}/docs/overview`,
    })

    const markdownContent = `# ${doc.title}\n${doc.content}`
    const filename = (docsPath || 'file').split('/').join('-')

    return new Response(markdownContent, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `inline; filename="${filename}.md"`,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Cdn-Cache-Control': 'max-age=300, stale-while-revalidate=300, durable',
      },
    })
  },
})
