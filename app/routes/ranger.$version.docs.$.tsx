import { createFileRoute } from '@tanstack/react-router'
import { rangerProject } from '~/projects/ranger'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/ranger/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: rangerProject.repo,
      branch: getBranch(rangerProject, version),
      docsPath: `docs/${docsPath}`,
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
