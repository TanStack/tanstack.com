import { useLoaderData } from '@remix-run/react'
import type { LoaderFunction, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/documents.server'
import { v1branch } from '../../v1'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { seo } from '~/utils/seo'
import removeMarkdown from 'remove-markdown'
import { Doc } from '~/components/Doc'

export const loader: LoaderFunction = async (context) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${docsPath}.md`

  const file = await fetchRepoFile('tanstack/router', v1branch, filePath)

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

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title ?? 'Docs'} | TanStack Router Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary
export const CatchBoundary = DefaultCatchBoundary

export default function RouteReactTableDocs() {
  const { title, code, filePath } = useLoaderData()

  return (
    <Doc
      title={title}
      code={code}
      repo={'tanstack/router'}
      branch={v1branch}
      filePath={filePath}
    />
  )
}
