import { repo, getBranch } from '~/projects/query'

import { seo } from '~/utils/seo'
import { useLoaderData, useParams } from '@tanstack/react-router'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const loader = async (context) => {
  const { _splat: docsPath, framework, version } = context.params
  const { url } = context.request

  return loadDocs({
    repo,
    branch: getBranch(version),
    docPath: `docs/framework/${framework}/${docsPath}`,
    currentPath: url,
    redirectPath: url.replace(`/docs/framework/${framework}/`, '/docs/'),
  })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return seo({
    title: `${data?.title} | TanStack Query Docs`,
    description: data?.description,
  })
}

export default function RouteDocs() {
  const { title, content, filePath } = Route.useLoaderData()
  const { version } = useParams()
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
