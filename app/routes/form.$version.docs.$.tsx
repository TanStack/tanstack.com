import { createFileRoute } from '@tanstack/react-router'
import { formProject } from '~/projects/form'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { getBranch } from '~/projects'

export const Route = createFileRoute('/form/$version/docs/$')({
  loader: (ctx) => {
    const { _splat: docsPath, version } = ctx.params

    return loadDocs({
      repo: formProject.repo,
      branch: getBranch(formProject, version),
      docsPath: `docs/${docsPath}`,
      currentPath: ctx.location.pathname,
      redirectPath: `/form/${version}/docs/overview`,
    })
  },
  meta: ({ loaderData }) =>
    seo({
      title: `${loaderData?.title} | TanStack Form Docs`,
      description: loaderData?.description,
    }),
  component: Docs,
})

function Docs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = Route.useParams()
  const branch = getBranch(formProject, version)

  return (
    <Doc
      title={title}
      content={content}
      repo={formProject.repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
