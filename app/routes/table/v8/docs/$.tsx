import { useLoaderData } from '@remix-run/react'
import { LoaderArgs, MetaFunction, json } from '@remix-run/node'

import {
  Doc,
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/documents.server'
import { v8branch } from '../../v8'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { seo } from '~/utils/seo'
import removeMarkdown from 'remove-markdown'

export const loader = async (context: LoaderArgs) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${docsPath}.md`

  const file = await fetchRepoFile('tanstack/table', v8branch, filePath)

  if (!file) {
    throw new Response('Not Found', {
      status: 404,
    })
  }

  console.log('file', file)

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
    title: `${data?.title ?? 'Docs'} | TanStack Table Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary
export const CatchBoundary = DefaultCatchBoundary

export default function RouteReactTableDocs() {
  const { title, code, filePath } = useLoaderData<typeof loader>()

  return (
    <div className="p-4 lg:p-6 overflow-auto w-full">
      <DocTitle>{title ?? ''}</DocTitle>
      <div className="h-4" />
      <div className="h-px bg-gray-500 opacity-20" />
      <div className="h-4" />
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Mdx code={code} />
      </div>
      <div className="h-12" />
      <div className="w-full h-px bg-gray-500 opacity-30" />
      <div className="py-4 opacity-70">
        <a
          href={`https://github.com/tanstack/table/tree/${v8branch}/${filePath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Edit on GitHub
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
