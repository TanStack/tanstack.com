import type { LoaderArgs, V2_MetaFunction } from '@remix-run/node'
import { repo, getBranch } from '~/routes/store'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import { useLoaderData, useParams } from '@remix-run/react'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const loader = async (context: LoaderArgs) => {
  const { '*': docsPath, framework, version } = context.params

  return loadDocs({
    repo,
    branch: getBranch(version),
    docPath: `docs/${framework}/${docsPath}`,
    redirectPath: context.request.url.replace(/\/docs.*/, ``),
  })
}

export const meta: V2_MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title} | TanStack Query Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteDocs() {
  const { title, code, filePath } = useLoaderData<typeof loader>()
  const { version } = useParams()
  const branch = getBranch(version)

  return (
    <Doc
      title={title}
      code={code}
      repo={repo}
      branch={branch}
      filePath={filePath}
    />
  )
}
