import type { LoaderArgs, MetaFunction} from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { json } from '@remix-run/node'
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
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { seo } from '~/utils/seo'
import removeMarkdown from 'remove-markdown'
import { useLoaderData, useParams } from '@remix-run/react'

export const loader = async (context: LoaderArgs) => {
  const { '*': docsPath, framework, version } = context.params

  // When first path part after docs does not contain framework name, add `react`
  if (
    !context.request.url.includes("/docs/react") &&
    !context.request.url.includes("/docs/solid") &&
    !context.request.url.includes("/docs/vue") &&
    !context.request.url.includes("/docs/svelte")
  ) {
    throw redirect(context.request.url.replace(/\/docs\//, "/docs/react/"));
  }

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${framework}/${docsPath}.md`

  const branch = getBranch(version);
  const file = await fetchRepoFile(repo, branch, filePath)

  if (!file) {
    throw redirect(context.request.url.replace(/\/docs.*/, `/docs/${framework}`));
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

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data?.title} | TanStack Query Docs`,
    description: data?.description,
  })
}

export const ErrorBoundary = DefaultErrorBoundary
export const CatchBoundary = DefaultCatchBoundary

export default function RouteReactQueryDocs() {
  const { title, code, filePath } = useLoaderData<typeof loader>()
  const { version } = useParams();
  const branch = getBranch(version);

  return (
    <div className="p-4 lg:p-6 overflow-auto w-full max-w-3xl">
      {title ? <DocTitle>{title}</DocTitle> : null}
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
          href={`https://github.com/${repo}/tree/${branch}/${filePath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Edit on GitHub
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
