import { useLoaderData, useParams } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { repo, getBranch } from '~/projects/router'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'

export const loader = async (context: LoaderFunctionArgs) => {
  const { '*': docsPath, version } = context.params
  const { url } = context.request

  return loadDocs({
    repo,
    branch: getBranch(version),
    docPath: `docs/${docsPath}`,
    currentPath: url,
    redirectPath: url.replace(/\/docs.*/, '/docs/framework/react/overview'),
  })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return seo({
    title: `${data?.title ?? 'Docs'} | TanStack Router Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const { title, content, filePath } = useLoaderData<typeof loader>()
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
