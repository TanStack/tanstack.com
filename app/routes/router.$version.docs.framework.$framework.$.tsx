import { routerProject } from '~/projects/router'
import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute(
  '/router/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo: routerProject.repo,
      branch: getBranch(routerProject, version),
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
  const branch = getBranch(routerProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={routerProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
