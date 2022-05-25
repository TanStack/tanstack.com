import * as React from 'react'
import { json, LoaderFunction, useLoaderData } from 'remix'
import { Doc, fetchRepoMarkdown } from '~/utils/docCache.server'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { format } from 'date-fns'

export const loader: LoaderFunction = async (context) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filepath = `app/blog/${docsPath}.md`

  const doc = await fetchRepoMarkdown(
    'tanstack',
    'main',
    filepath,
    process.env.NODE_ENV === 'development'
  )

  return json(doc)
}

export default function RouteReactTableDocs() {
  const doc = useLoaderData() as Doc

  return (
    <div className="p-4 lg:p-6 max-w-screen-lg mx-auto">
      <div>
        <DocTitle>{doc.mdx.frontmatter.title ?? ''}</DocTitle>
        <div className="h-2" />
        {doc.mdx.frontmatter.published ? (
          <div>
            {format(new Date(doc.mdx.frontmatter.published), 'MMM d, yyyy')}
          </div>
        ) : null}
        <div className="h-4" />
        <div className="h-px bg-gray-500 opacity-20" />
        <div className="h-4" />
      </div>
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Mdx code={doc.mdx.code} />
      </div>
      <div className="h-8" />
      <hr />
      <div className="py-4">
        <a
          href={`https://github.com/tanstack/tanstack.com/tree/main/${doc.filepath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Suggest Changes on Github
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
