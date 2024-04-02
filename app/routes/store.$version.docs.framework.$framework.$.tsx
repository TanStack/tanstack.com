import { storeProject } from '~/projects/store'
import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute(
  '/store/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo: storeProject.repo,
      branch: getBranch(storeProject, version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/store/${version}/docs/framework/${framework}/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Store Docs`,
      description: loaderData?.description,
    }),
  component: RouteDocs,
})

function RouteDocs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(storeProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={storeProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
