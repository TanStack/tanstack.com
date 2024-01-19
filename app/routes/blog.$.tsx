import { useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import removeMarkdown from 'remove-markdown'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'

export const loader = async (context: LoaderFunctionArgs) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `app/blog/${docsPath}.md`

  const file = await fetchRepoFile('tanstack/tanstack.com', 'main', filePath)

  if (!file) {
    throw new Response('Not Found', {
      status: 404,
    })
  }

  const frontMatter = extractFrontMatter(file)
  const description = removeMarkdown(frontMatter.excerpt ?? '')

  return json({
    title: frontMatter.data.title,
    description,
    published: frontMatter.data.published,
    content: frontMatter.content,
    filePath,
  })
}

export const meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title ?? 'Docs'} | TanStack Blog`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const { title, content, filePath } = useLoaderData<typeof loader>()

  return (
    <Doc
      title={title}
      content={content}
      repo={'tanstack/tanstack.com'}
      branch={'main'}
      filePath={filePath}
    />
  )
}
