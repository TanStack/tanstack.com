import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { rangerProject } from '~/projects/ranger'
import { getBranch } from '~/projects'

export const Route = createFileRoute(
  '/ranger/$version/docs/framework/$framework/$'
)({
  loader: (ctx) => {
    const { _splat: docsPath, framework, version } = ctx.params

    return loadDocs({
      repo: rangerProject.repo,
      branch: getBranch(rangerProject, version),
      docsPath: `docs/framework/${framework}/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/ranger/${version}/docs/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Ranger Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(rangerProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={rangerProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
