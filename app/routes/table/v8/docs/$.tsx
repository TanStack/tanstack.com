import { json, LoaderFunction, useLoaderData } from 'remix'
import {
  Doc,
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from '~/utils/docCache.server'
import { v8branch } from '../../v8'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

export const loader: LoaderFunction = async (context) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${docsPath}.md`

  const file = await fetchRepoFile('tanstack/table', v8branch, filePath)

  if (!file) {
    throw new Error('File not found')
  }

  const frontMatter = extractFrontMatter(file)

  const mdx = await markdownToMdx(frontMatter.content)

  return json(
    {
      code: mdx.code,
      title: frontMatter.data.title,
      filePath,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=1, stale-while-revalidate=300',
      },
    }
  )
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const { title, code, filePath } = useLoaderData()

  return (
    <div className="p-4 lg:p-6">
      <DocTitle>{title ?? ''}</DocTitle>
      <div className="h-4" />
      <div className="h-px bg-gray-500 opacity-20" />
      <div className="h-4" />
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Mdx code={code} />
      </div>
      <div className="h-4" />
      <hr />
      <div className="py-4">
        <a
          href={`https://github.com/tanstack/table/tree/${v8branch}/${filePath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Edit on Github
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
