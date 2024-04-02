import { virtualProject } from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute(
  '/virtual/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo: virtualProject.repo,
      branch: getBranch(virtualProject, version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/virtual/${version}/docs/framework/${framework}/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Virtual Docs`,
      description: loaderData?.description,
    }),
  component: RouteDocs,
})

function RouteDocs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(virtualProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={virtualProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
