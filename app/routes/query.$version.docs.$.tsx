import { createFileRoute } from '@tanstack/react-router'
import { queryProject } from '~/projects/query'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/query/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: queryProject.repo,
      branch: getBranch(queryProject, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/query/${version}/docs/framework/react/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Query Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(queryProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={queryProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
