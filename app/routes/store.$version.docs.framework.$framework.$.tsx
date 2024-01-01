import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import type { GithubDocsConfig } from '~/routes/store'
import { repo, getBranch } from '~/routes/store'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import { useLoaderData, useParams } from '@remix-run/react'
import { Doc } from '~/components/Doc'
import { loadDocs } from '~/utils/docs'
import { fetchRepoFile } from '~/utils/documents.server'

export const loader = async (context: LoaderFunctionArgs) => {
  const { '*': docsPath, framework, version } = context.params
  const branch = getBranch(context.params.version)
  const config = await fetchRepoFile(repo, branch, `docs/config.json`)

  if (!config) {
    throw new Error('Repo docs/config.json not found!')
  }

  const parsedConfig = JSON.parse(config) as GithubDocsConfig

  const frameworkDoc = `framework/${framework}/${docsPath}`
  let docPath = `docs/${frameworkDoc}`

  if (framework) {
    const stringToDrop = `framework/${framework}/`

    const frameworkDocPageIds = parsedConfig.frameworkMenus
      .find((f) => f.framework === framework)
      ?.menuItems.flatMap((m) =>
        m.children.map((c) => c.to.slice(stringToDrop.length))
      )

    if (
      frameworkDocPageIds &&
      docsPath &&
      frameworkDocPageIds.includes(docsPath)
    ) {
      return loadDocs({
        repo,
        branch: getBranch(version),
        docPath,
        redirectPath: context.request.url.replace(/\/docs.*/, ``),
      })
    } else {
      // Assume that it's a "core" doc page
      return loadDocs({
        repo,
        branch: getBranch(version),
        docPath: `docs/${docsPath}`,
        redirectPath: context.request.url.replace(/\/docs.*/, ``),
      })
    }
  }
}

export const meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title} | TanStack Store Docs`,
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
