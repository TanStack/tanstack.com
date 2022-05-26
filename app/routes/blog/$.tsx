import * as React from 'react'
import { json, LoaderFunction, useLoaderData } from 'remix'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/docCache.server'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { format } from 'date-fns'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

export const loader: LoaderFunction = async (context) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `app/blog/${docsPath}.md`

  const file = await fetchRepoFile(
    'tanstack/tanstack.com',
    'main',
    filePath,
    process.env.NODE_ENV === 'development'
  )

  if (!file) {
    throw new Error('File not found')
  }

  const frontMatter = extractFrontMatter(file)

  const mdx = await markdownToMdx(frontMatter.content)

  return json({
    title: frontMatter.data.title,
    published: frontMatter.data.published,
    code: mdx.code,
    filePath,
  })
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const { title, published, code, filePath } = useLoaderData()

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto">
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
          <FaEdit /> Suggest Changes on Github
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
