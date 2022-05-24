import * as React from 'react'
import { json, LoaderFunction, useLoaderData } from 'remix'
import { getMDXComponent } from 'mdx-bundler/client'
import { Doc, fetchRepoMarkdown } from '~/utils/docCache.server'
import { v8branch } from '../../v8'
import { MarkdownLink } from '~/components/MarkdownLink'
import { CodeBlock } from '~/components/CodeBlock'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'

export const loader: LoaderFunction = async (context) => {
  const { '*': docsPath } = context.params

  if (!docsPath) {
    throw new Error('Invalid docs path')
  }

  const filePath = `docs/${docsPath}.md`

  const doc = await fetchRepoMarkdown(
    'tanstack/react-table',
    v8branch,
    filePath
  )

  console.log()

  return json(doc, {
    headers: {
      'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
    },
  })
}

const CustomHeading = ({
  Comp,
  id,
  ...props
}: React.HTMLProps<HTMLHeadingElement> & {
  Comp: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}) => {
  if (id) {
    return (
      <a href={`#${id}`} className={`anchor-heading`}>
        <Comp id={id} {...props} />
      </a>
    )
  }
  return <Comp {...props} />
}

const makeHeading =
  (type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  (props: React.HTMLProps<HTMLHeadingElement>) =>
    <CustomHeading Comp={type} {...props} />

const markdownComponents = {
  a: MarkdownLink,
  pre: CodeBlock,
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
}

export default function RouteReactTableDocs() {
  const doc = useLoaderData() as Doc

  const Doc = React.useMemo(() => getMDXComponent(doc.mdx.code), [doc.mdx.code])

  return (
    <div className="p-4 lg:p-6">
      <DocTitle>{doc.mdx.frontmatter.title ?? ''}</DocTitle>
      <div className="h-4 lg:h-8" />
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Doc components={markdownComponents} />
      </div>
      <div className="h-8" />
      <hr />
      <div className="py-4">
        <a
          href={`https://github.com/tanstack/react-table/tree/${v8branch}/${doc.filepath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Edit on Github
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
