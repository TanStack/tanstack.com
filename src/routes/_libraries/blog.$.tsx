import {
  Link,
  notFound,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { formatAuthors } from '~/utils/blog'
import { format } from 'date-fns'
import { z } from 'zod'
import { FaArrowLeft, FaEdit } from 'react-icons/fa'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { allPosts } from 'content-collections'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import { CopyMarkdownButton } from '~/components/CopyMarkdownButton'
import { GamFooter, GamHeader } from '~/components/Gam'
import { AdGate } from '~/contexts/AdsContext'

function handleRedirects(docsPath: string) {
  if (docsPath.includes('directives-the-new-framework-lock-in')) {
    throw redirect({
      href: '/blog/directives-and-the-platform-boundary',
    })
  }
}

const fetchBlogPost = createServerFn({ method: 'GET' })
  .inputValidator(z.string().optional())
  .handler(async ({ data: docsPath }) => {
    if (!docsPath) {
      throw new Error('Invalid docs path')
    }

    handleRedirects(docsPath)

    const filePath = `src/blog/${docsPath}.md`

    const post = allPosts.find((post) => post.slug === docsPath)

    if (!post) {
      throw notFound()
    }

    setResponseHeaders(
      new Headers({
        'cache-control': 'public, max-age=0, must-revalidate',
        'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
        'Netlify-Vary': 'query=payload',
      })
    )

    return {
      title: post.title,
      description: post.description,
      published: post.published,
      content: post.content,
      authors: post.authors,
      headerImage: post.headerImage,
      filePath,
    }
  })

export const Route = createFileRoute('/_libraries/blog/$')({
  staleTime: Infinity,
  loader: ({ params }) => fetchBlogPost({ data: params._splat }),
  head: ({ loaderData }) => {
    return {
      meta: loaderData
        ? [
            ...seo({
              title: `${loaderData?.title ?? 'Docs'} | TanStack Blog`,
              description: loaderData?.description,
              image: loaderData?.headerImage
                ? `https://tanstack.com${loaderData.headerImage}`
                : undefined,
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

function BlogPost() {
  const { title, content, filePath, authors, published } = Route.useLoaderData()

  const blogContent = `_by ${formatAuthors(authors)} on ${format(
    new Date(published || 0),
    'MMM dd, yyyy'
  )}._
${content}`

  const repo = 'tanstack/tanstack.com'
  const branch = 'main'

  return (
    <div
      className={`
        min-h-[calc(100dvh-var(--navbar-height))]
        flex flex-col
        w-full transition-all duration-300`}
    >
      <div className="flex flex-col max-w-full min-w-0 w-full min-h-0 relative mb-8">
        <div className="min-w-0 flex justify-center w-full min-h-[88dvh] lg:min-h-0 mx-auto">
          <div className="flex-1 flex flex-col w-full">
            <AdGate>
              <div
                className="mt-4 mb-4 bg-white/50 dark:bg-white/5
              shadow-xl shadow-black/2 flex justify-center w-fit max-w-full mx-auto h-[90px]"
              >
                <GamHeader />
              </div>
            </AdGate>
            <div className="px-4">
              <div className="w-full max-w-[936px] mx-auto">
                <div className="mt-4 mb-2 md:mb-6 lg:mb-8">
                  <Link
                    from="/blog/$"
                    to="/blog"
                    className="font-black inline-flex items-center gap-2 p-1"
                  >
                    <FaArrowLeft />
                    Back to Blog
                  </Link>
                </div>
              </div>
              <div className="w-full max-w-[936px] mx-auto">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="w-full flex bg-white/70 dark:bg-black/40 rounded-xl">
                    <div className="flex overflow-auto flex-col w-full p-2 lg:p-4 xl:p-6">
                      {title ? (
                        <div className="flex items-center justify-between gap-4 pr-2 lg:pr-4">
                          <DocTitle>{title}</DocTitle>
                          <div className="flex items-center gap-4">
                            <CopyMarkdownButton
                              repo={repo}
                              branch={branch}
                              filePath={filePath}
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="h-4" />
                      <div className="h-px bg-gray-500 opacity-20" />
                      <div className="h-4" />
                      <div
                        className={twMerge(
                          'prose prose-gray dark:prose-invert max-w-none',
                          '[font-size:14px]',
                          'styled-markdown-content'
                        )}
                      >
                        <Markdown rawContent={blogContent} />
                      </div>
                      <div className="h-12" />
                      <div className="w-full h-px bg-gray-500 opacity-30" />
                      <div className="flex py-4 opacity-70">
                        <a
                          href={`https://github.com/${repo}/edit/${branch}/${filePath}`}
                          className="flex items-center gap-2"
                        >
                          <FaEdit /> Edit on GitHub
                        </a>
                      </div>
                      <div className="h-24" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <AdGate>
          <div className="mb-8 !py-0! mx-auto max-w-full overflow-x-hidden flex justify-center">
            <GamFooter />
          </div>
        </AdGate>
      </div>
    </div>
  )
}
