import { useLoaderData } from '@remix-run/react'
import type { LoaderArgs, V2_MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/documents.server'
import { v3branch } from './virtual.v3'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { seo } from '~/utils/seo'
import removeMarkdown from 'remove-markdown'
import { Doc } from '~/components/Doc'

export const loader = async (context: LoaderArgs) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${docsPath}.md`

  const file = await fetchRepoFile('tanstack/virtual', v3branch, filePath)

  if (!file) {
    throw new Response('Not Found', {
      status: 404,
    })
  }

  const frontMatter = extractFrontMatter(file)
  const description = removeMarkdown(frontMatter.excerpt ?? '')

  const mdx = await markdownToMdx(frontMatter.content)

  return json(
    {
      title: frontMatter.data.title,
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
    title: `${data?.title ?? 'Docs'} | TanStack Table Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const { title, code, filePath } = useLoaderData<typeof loader>()

  return (
    <Doc
      title={title}
      code={code}
      repo={'tanstack/virtual'}
      branch={v3branch}
      filePath={filePath}
    />
  )
}
