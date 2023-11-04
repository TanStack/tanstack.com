import type { LoaderArgs, V2_MetaFunction } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/documents.server'
import { repo, getBranch } from '~/routes/query'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import removeMarkdown from 'remove-markdown'
import { useLoaderData, useParams } from '@remix-run/react'
import { Doc } from '~/components/Doc'

export const loader = async (context: LoaderArgs) => {
  const { '*': docsPath, framework, version } = context.params
  const url = new URL(context.request.url)

  // When first path part after docs does not contain framework name, add `react`
  if (
    !context.request.url.includes('/docs/react') &&
    !context.request.url.includes('/docs/solid') &&
    !context.request.url.includes('/docs/vue') &&
    !context.request.url.includes('/docs/svelte')
  ) {
    throw redirect(context.request.url.replace(/\/docs\//, '/docs/react/'))
  }

  // Redirect old `adapters` pages
  const adaptersRedirects = [
    { from: 'docs/react/adapters/vue-query', to: 'docs/vue/overview' },
    { from: 'docs/react/adapters/solid-query', to: 'docs/solid/overview' },
    { from: 'docs/react/adapters/svelte-query', to: 'docs/svelte/overview' },
  ]

  adaptersRedirects.forEach((item) => {
    if (url.pathname.startsWith(`/query/v4/${item.from}`)) {
      throw redirect(`/query/latest/${item.to}`, 301)
    }
  })

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${framework}/${docsPath}.md`

  const branch = getBranch(version)
  const file = await fetchRepoFile(repo, branch, filePath)

  if (!file) {
    throw redirect(
      context.request.url.replace(/\/docs.*/, `/docs/${framework}`)
    )
  }

  const frontMatter = extractFrontMatter(file)
  const description = removeMarkdown(frontMatter.excerpt ?? '')

  const mdx = await markdownToMdx(frontMatter.content)

  return json(
    {
      title: frontMatter.data?.title,
      description,
      filePath,
      code: mdx.code,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=1, stale-while-revalidate=300',
      },
    }
  )
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
