import { Link, notFound } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Doc } from '~/components/Doc'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { formatAuthors } from '~/utils/blog'
import { format } from 'date-fns'
import { z } from 'zod'
import { FaArrowLeft } from 'react-icons/fa'
import { DocContainer } from '~/components/DocContainer'
import { setHeaders } from '@tanstack/react-start/server'
import { allPosts } from 'content-collections'

const fetchBlogPost = createServerFn({ method: 'GET' })
  .validator(z.string().optional())
  .handler(async ({ data: docsPath }) => {
    if (!docsPath) {
      throw new Error('Invalid docs path')
    }

    const filePath = `src/blog/${docsPath}.md`

    const post = allPosts.find((post) => post.slug === docsPath)

    if (!post) {
      throw notFound()
    }

    setHeaders({
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
      'Netlify-Vary': 'query=payload',
    })

    return {
      title: post.title,
      description: post.description,
      published: post.published,
      content: post.content,
      authors: post.authors,
      filePath,
    }
  })

export const Route = createFileRoute({
  staleTime: Infinity,
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
    'MMM dd, yyyy'
  )}._
${content}`

  return (
    <DocContainer>
      <div className="mb-2 md:mb-6 lg:mb-8">
        <Link
          from="/blog/$"
          to="/blog"
          className="font-bold flex items-center gap-2 p-1"
        >
          <FaArrowLeft />
          Back
        </Link>
      </div>
      <Doc
        title={title}
        content={blogContent}
        repo={'tanstack/tanstack.com'}
        branch={'main'}
        filePath={filePath}
      />
    </DocContainer>
  )
}
