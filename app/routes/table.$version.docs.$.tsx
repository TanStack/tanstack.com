import { tableProject } from '~/projects/table'

import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { loadDocs } from '~/utils/docs'
import { Doc } from '~/components/Doc'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/table/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: tableProject.repo,
      branch: getBranch(tableProject, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: '/table/latest/docs/introduction',
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Table Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
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
