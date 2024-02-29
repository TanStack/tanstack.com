import { repo, getBranch } from '~/projects/router'
import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const Route = createFileRoute(
  '/router/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo,
      branch: getBranch(version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/router/${version}/docs/framework/${framework}/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Router Docs`,
      description: loaderData?.description,
    }),
  component: RouteDocs,
})

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
