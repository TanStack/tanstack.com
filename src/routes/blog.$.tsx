import { notFound, redirect, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import {
  formatAuthors,
  formatPublishedDate,
  isPublishedDateReleased,
} from '~/utils/blog'
import * as v from 'valibot'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { allPosts } from 'content-collections'
import * as React from 'react'
import { MarkdownContent } from '~/components/markdown'
import { Card } from '~/components/Card'
import { LibrariesWidget } from '~/components/LibrariesWidget'
import { partners } from '~/utils/partners'
import { PartnersRail, RightRail } from '~/components/RightRail'
import { RecentPostsWidget } from '~/components/RecentPostsWidget'

import { Toc } from '~/components/Toc'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { renderMarkdown } from '~/utils/markdown'

function handleRedirects(docsPath: string) {
  if (docsPath.includes('directives-the-new-framework-lock-in')) {
    throw redirect({
      href: '/blog/directives-and-the-platform-boundary',
    })
  }
}

const fetchBlogPost = createServerFn({ method: 'GET' })
  .inputValidator(v.optional(v.string()))
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
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=300',
      }),
    )

    const isUnpublished = post.draft || !isPublishedDateReleased(post.published)
    return {
      title: post.title,
      description: post.excerpt,
      published: post.published,
      content: post.content,
      authors: post.authors,
      headerImage: post.headerImage,
      filePath,
      isUnpublished,
    }
  })

export const Route = createFileRoute('/blog/$')({
  staleTime: Infinity,
  loader: ({ params }) => fetchBlogPost({ data: params._splat }),
  head: ({ loaderData }) => {
    // Generate optimized social media image URL using Netlify Image CDN
    const getSocialImageUrl = (headerImage?: string) => {
      if (!headerImage) return undefined

      // Use Netlify Image CDN to optimize for social media (1200x630 is the standard for og:image)

      return `https://tanstack.com/.netlify/images?url=${encodeURIComponent(
        headerImage,
      )}&w=1200&h=630&fit=cover&fm=jpg&q=80`
    }

    return {
      meta: loaderData
        ? [
            ...seo({
              title: `${loaderData?.title ?? 'Docs'} | TanStack Blog`,
              description: loaderData?.description,
              image: getSocialImageUrl(loaderData?.headerImage),
              noindex: loaderData?.isUnpublished,
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

  const blogContent = `<small>_by ${formatAuthors(authors)} on ${formatPublishedDate(
    published || '1970-01-01',
  )}._</small>

${content}`

  const { headings, markup } = React.useMemo(
    () => renderMarkdown(blogContent),
    [blogContent],
  )

  const isTocVisible = headings.length > 1

  const markdownContainerRef = React.useRef<HTMLDivElement>(null)
  const [activeHeadings, setActiveHeadings] = React.useState<Array<string>>([])

  const headingElementRefs = React.useRef<
    Record<string, IntersectionObserverEntry>
  >({})

  React.useEffect(() => {
    const callback = (headingsList: Array<IntersectionObserverEntry>) => {
      headingElementRefs.current = headingsList.reduce(
        (map, headingElement) => {
          map[headingElement.target.id] = headingElement
          return map
        },
        headingElementRefs.current,
      )

      const visibleHeadings: Array<IntersectionObserverEntry> = []
      Object.keys(headingElementRefs.current).forEach((key) => {
        const headingElement = headingElementRefs.current[key]
        if (headingElement.isIntersecting) {
          visibleHeadings.push(headingElement)
        }
      })

      if (visibleHeadings.length >= 1) {
        setActiveHeadings(visibleHeadings.map((h) => h.target.id))
      }
    }

    const observer = new IntersectionObserver(callback, {
      rootMargin: '0px',
      threshold: 0.2,
    })

    const headingElements = Array.from(
      markdownContainerRef.current?.querySelectorAll(
        'h2[id], h3[id], h4[id], h5[id], h6[id]',
      ) ?? [],
    )
    headingElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [headings])

  const repo = 'tanstack/tanstack.com'
  const branch = 'main'
  const activePartners = React.useMemo(
    () =>
      partners.filter(
        (d) =>
          d.status === 'active' &&
          d.name !== 'Nozzle.io' &&
          d.id !== 'fireship',
      ),
    [],
  )

  return (
    <div
      className={`
        min-h-[calc(100dvh-var(--navbar-height))]
        flex flex-col
        w-full transition-all duration-300`}
    >
      <div className="flex flex-col max-w-full min-w-0 w-full min-h-0 relative mb-8">
        <div className="min-w-0 flex justify-center w-full min-h-[88dvh] lg:min-h-0 mx-auto">
          <div className="flex-1 flex flex-col w-full min-w-0">
            <div className="px-4 pt-4 lg:pt-6">
              <div className="w-full max-w-[1100px] mx-auto">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="w-full flex justify-center">
                    <div
                      className={[
                        'w-full p-2 lg:p-4 xl:p-6',
                        isTocVisible ? 'max-w-full' : 'max-w-[768px]',
                      ].join(' ')}
                    >
                      <Breadcrumbs
                        section="Blog"
                        sectionTo="/blog"
                        headings={isTocVisible ? headings : undefined}
                        tocHiddenBreakpoint="lg"
                      />
                    </div>
                    {isTocVisible && (
                      <div className="pl-4 w-32 lg:w-36 xl:w-44 2xl:w-56 3xl:w-64 shrink-0 hidden lg:block" />
                    )}
                  </div>
                  <div
                    className={[
                      'w-full flex justify-center mx-auto',
                      isTocVisible ? 'max-w-full' : 'max-w-[768px]',
                    ].join(' ')}
                  >
                    <div className="flex overflow-auto flex-col w-full p-2 lg:p-4 xl:p-6 pt-0">
                      <MarkdownContent
                        title={title}
                        htmlMarkup={markup}
                        repo={repo}
                        branch={branch}
                        filePath={filePath}
                        containerRef={markdownContainerRef}
                      />
                    </div>
                    {isTocVisible && (
                      <div className="pl-4 w-32 lg:w-36 xl:w-44 2xl:w-56 3xl:w-64 shrink-0 hidden lg:block py-4 transition-all">
                        <Toc
                          headings={headings}
                          activeHeadings={activeHeadings}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <RightRail breakpoint="md">
            <PartnersRail partners={activePartners} />
            <div className="hidden md:block border border-gray-500/20 rounded-l-lg overflow-hidden w-full">
              <RecentPostsWidget />
            </div>
            <Card>
              <LibrariesWidget />
            </Card>
          </RightRail>
        </div>
      </div>
    </div>
  )
}
