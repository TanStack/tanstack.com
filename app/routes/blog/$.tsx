import * as React from 'react'
import { useLoaderData } from '@remix-run/react'
import type { LoaderArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/documents.server'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { format } from 'date-fns'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import removeMarkdown from 'remove-markdown'
import { seo } from '~/utils/seo'

export const loader = async (context: LoaderArgs) => {
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

  const mdx = await markdownToMdx(frontMatter.content)

  return json({
    title: frontMatter.data.title,
    description,
    published: frontMatter.data.published,
    code: mdx.code,
    filePath,
  })
}

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title ?? 'Docs'} | TanStack Blog`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary
export const CatchBoundary = DefaultCatchBoundary

export default function RouteReactTableDocs() {
  const { title, published, code, filePath } = useLoaderData<typeof loader>()

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto overflow-auto">
      <div>
        <DocTitle>{title ?? ''}</DocTitle>
        <div className="h-2" />
        {published ? (
          <div>{format(new Date(published), 'MMM d, yyyy')}</div>
        ) : null}
        <div className="h-4" />
        <div className="h-px bg-gray-500 opacity-20" />
        <div className="h-4" />
      </div>
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Mdx code={code} />
      </div>
      <div className="h-8" />
      <hr />
      <div className="py-4">
        <a
          href={`https://github.com/tanstack/tanstack.com/tree/main/${filePath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Suggest Changes on GitHub
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
