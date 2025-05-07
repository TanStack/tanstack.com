import {  createAPIRoute } from '@tanstack/start/api'
import { getBranch, getLibrary } from '~/libraries'
import { loadDocs } from '~/utils/docs'

export const APIRoute = createAPIRoute('/api/md/$libraryId/$version/docs/framework/$framework/$')({
  GET: async ({ params, request }) => {
    const { libraryId, version, framework, _splat: docsPath } = params
    const library = getLibrary(libraryId)

    const location = new URL(request.url)

    const loadDocsArgs = {
      repo: library.repo,
      branch: getBranch(library, version),
      docsPath: `${
        library.docsRoot || 'docs'
      }/framework/${framework}/${docsPath}`,
      currentPath: location.pathname.slice('/api/md'.length),
      redirectPath: `/${library.id}/${version}/docs/overview`,
      useServerFn: false
    }

    const res = await loadDocs(loadDocsArgs)

    const { content, description, title} = res

    // Generate or fetch the Markdown content dynamically
    const markdownContent = `# ${title}\n\n> ${description}\n\n${content}`

    const filename = (docsPath || 'file').split('/').join('-')

    // Return the Markdown content as a response
    return new Response(markdownContent, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `inline; filename="${filename}.md"`,
      },
    })
  },
})
