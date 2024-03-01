import { createFileRoute } from '@tanstack/react-router'
import { repo, getBranch } from '~/projects/virtual'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const Route = createFileRoute('/virtual/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo,
      branch: getBranch(version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: '/virtual/latest/docs/introduction',
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Virtual Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
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
