import { createFileRoute, notFound } from '@tanstack/react-router'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/start'
import { formatAuthors } from '~/utils/blog'
import { format } from 'date-fns'
import { z } from 'zod'

const fetchBlogPost = createServerFn({ method: 'GET' })
  .validator(z.string().optional())
  .handler(async ({ data: docsPath }) => {
    if (!docsPath) {
      throw new Error('Invalid docs path')
    }

    const filePath = `app/blog/${docsPath}.md`

    const file = await fetchRepoFile('tanstack/tanstack.com', 'main', filePath)

    if (!file) {
      throw notFound()
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    return {
      title: frontMatter.data.title,
      description,
      published: frontMatter.data.published,
      content: frontMatter.content,
      authors: (frontMatter.data.authors ?? []) as Array<string>,
      filePath,
    }
  })

export const Route = createFileRoute('/_libraries/blog/$')({
  loader: ({ params }) => fetchBlogPost({ data: params._splat }),
  head: ({ loaderData }) => {
    return {
      meta: loaderData
        ? [
            ...seo({
              title: `${loaderData?.title ?? 'Docs'} | TanStack Blog`,
              description: loaderData?.description,
            }),
            {
              name: 'author',
              content: `${
                loaderData.authors.length > 1 ? 'co-authored by ' : ''
              }${formatAuthors(loaderData.authors)}`,
            },
          ]
        : [],
    }
  },
  notFoundComponent: () => <PostNotFound />,
  component: BlogPost,
})

export default function BlogPost() {
  const { title, content, filePath, authors, published } = Route.useLoaderData()

  const blogContent = `_by ${formatAuthors(authors)} on ${format(
    new Date(published || 0),
    'MMM dd, yyyy',
  )}._
${content}`

  return (
    <Doc
      title={title}
      content={blogContent}
      repo={'tanstack/tanstack.com'}
      branch={'main'}
      filePath={filePath}
    />
  )
}
