import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { repo, getBranch, reactTableV7List } from '~/projects/table'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import { useLoaderData, useParams } from '@remix-run/react'
import { loadDocs } from '~/utils/docs'
import { Doc } from '~/components/Doc'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const loader = (context: LoaderFunctionArgs) => {
  handleRedirects(
    reactTableV7List,
    context.request.url,
    '/table/v7',
    '/table/v8',
    'from=reactTableV7'
  )

  const { '*': docsPath, version } = context.params
  const { url } = context.request

  return loadDocs({
    repo,
    branch: getBranch(version),
    docPath: `docs/${docsPath}`,
    currentPath: url,
    redirectPath: url.replace(/\/docs.*/, '/docs/introduction'),
  })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return seo({
    title: `${data?.title} | TanStack Table Docs`,
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
