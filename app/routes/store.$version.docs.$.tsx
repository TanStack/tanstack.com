import { storeProject } from '~/projects/store'

import { seo } from '~/utils/seo'
import { createFileRoute } from '@tanstack/react-router'
import { loadDocs } from '~/utils/docs'
import { Doc } from '~/components/Doc'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/store/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: storeProject.repo,
      branch: getBranch(storeProject, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: '/store/latest/docs/introduction',
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Store Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
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
