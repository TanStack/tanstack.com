import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { DocContainer } from '~/components/DocContainer'
import { getBranch, getLibrary } from '~/libraries'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { fetchDocs } from '~/utils/docs.functions'
import { ogImageUrl } from '~/utils/og'
import { seo } from '~/utils/seo'
import { beforeLoadLibraryLanding } from '../-library-landing-route'

const library = getLibrary('markdown')
const filePath = 'reports/sizes.md'

export const Route = createFileRoute(
  '/_library/markdown/$version/reports/sizes',
)({
  staleTime: 1000 * 60 * 5,
  beforeLoad: ({ params, location }) => {
    beforeLoadLibraryLanding('markdown', params.version, location.href)
  },
  loader: async ({ params, context: { queryClient } }) => {
    const branch = getBranch(library, params.version)
    const [config, report] = await Promise.all([
      queryClient.ensureQueryData(
        docsConfigQueryOptions('markdown', params.version),
      ),
      fetchDocs({
        data: {
          repo: library.repo,
          branch,
          filePath,
        },
      }),
    ])

    return {
      ...report,
      branch,
      config,
    }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: `Bundle Size Results | ${library.name}`,
      description: loaderData?.description,
      image: ogImageUrl(library.id),
      noindex: library.visible === false,
    }),
  }),
  headers: ({ params }) =>
    getDocsCacheHeaders({ libraryId: library.id, version: params.version }),
  component: MarkdownBundleSizeReport,
})

function MarkdownBundleSizeReport() {
  const { branch, content } = Route.useLoaderData()

  return (
    <DocContainer className="px-4 md:px-8">
      <Doc
        title="Bundle Size Results"
        content={content}
        repo={library.repo}
        branch={branch}
        filePath={filePath}
        colorFrom={library.colorFrom}
        colorTo={library.colorTo}
        textColor={library.textColor}
      />
    </DocContainer>
  )
}
