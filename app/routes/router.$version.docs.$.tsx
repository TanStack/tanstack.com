import { createFileRoute, redirect } from '@tanstack/react-router'
import { routerProject } from '~/projects/router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/router/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: routerProject.repo,
      branch: getBranch(routerProject, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: '/router/latest/docs/framework/react/overview',
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title ?? 'Docs'} | TanStack Router Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(routerProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={routerProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
