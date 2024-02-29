import { createFileRoute } from '@tanstack/react-router'
import { repo, getBranch } from '~/projects/router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const Route = createFileRoute('/form/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    console.log(docsPath)

    return loadDocs({
      repo,
      branch: getBranch(version),
      docsPath,
      currentPath: ctx.location.pathname,
      redirectPath: '/form/latest/docs/framework/react/overview',
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Form Docs`,
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
