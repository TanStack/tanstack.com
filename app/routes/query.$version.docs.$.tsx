import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { repo, getBranch } from '~/projects/query'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import { redirect, useLoaderData, useParams } from '@remix-run/react'
import { loadDocs } from '~/utils/docs'
import { Doc } from '~/components/Doc'

export const loader = async (context: LoaderFunctionArgs) => {
  const { '*': docsPath, version } = context.params
  const { url } = context.request

  // Temporary fix for old docs structure
  if (url.includes('/docs/react/')) {
    throw redirect(url.replace('/docs/react/', '/docs/framework/react/'))
  }

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
    title: `${data?.title} | TanStack Query Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteDocs() {
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
