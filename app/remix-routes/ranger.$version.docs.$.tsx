import { useLoaderData, useParams } from '@tanstack/react-router'

import { repo, getBranch } from '~/projects/ranger'

import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const loader = async (context) => {
  const { _splat: docsPath, version } = context.params
  const { url } = context.request

  return loadDocs({
    repo,
    branch: getBranch(version),
    docPath: `docs/${docsPath}`,
    currentPath: url,
    redirectPath: url.replace(/\/docs.*/, '/docs/overview'),
  })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return seo({
    title: `${data?.title ?? 'Docs'} | TanStack Ranger Docs`,
    description: data?.description,
  })
}

export default function RouteReactRangerDocs() {
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
