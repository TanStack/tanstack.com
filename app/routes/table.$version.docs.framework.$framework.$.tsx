import { tableProject } from '~/projects/table'
import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute(
  '/table/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo: tableProject.repo,
      branch: getBranch(tableProject, version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/table/${version}/docs/framework/${framework}/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Table Docs`,
      description: loaderData?.description,
    }),
  component: RouteDocs,
})

function RouteDocs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(tableProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={tableProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
