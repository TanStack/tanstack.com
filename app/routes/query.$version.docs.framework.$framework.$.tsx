// import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { repo, getBranch } from '~/projects/query'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
// import { useLoaderData, useParams } from '@remix-run/react'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/query/$version/docs/framework/$framework/$'
)({
  headers: () => ({
    // 'Cache-Control': 's-maxage=1, stale-while-revalidate=300',
  }),
  loader: ({ location, params: { _splat, framework, version } }) => {
    return loadDocs({
      repo,
      branch: getBranch(version),
      docPath: `docs/framework/${framework}/${_splat}`,
      currentPath: location.href,
      redirectPath: location.href.replace(
        `/docs/framework/${framework}/`,
        '/docs/'
      ),
    })
  },
  component: RouteDocs
})

// export const loader = async (context: LoaderFunctionArgs) => {
//   const { '*': docsPath, framework, version } = context.params
// }

// export const meta: MetaFunction<typeof loader> = ({ data }) => {
//   return seo({
//     title: `${data?.title} | TanStack Query Docs`,
//     description: data?.description,
//   })
// }

function RouteDocs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(version)

  return (
    <Doc
      title={title}
      content={content}
      repo={repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
