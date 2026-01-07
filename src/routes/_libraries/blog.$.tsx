import { notFound, createFileRoute, redirect } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { formatAuthors } from '~/utils/blog'
import { format } from '~/utils/dates'
import * as v from 'valibot'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { allPosts } from 'content-collections'
import * as React from 'react'
import { MarkdownContent } from '~/components/MarkdownContent'
import { GamHeader } from '~/components/Gam'
import { AdGate } from '~/contexts/AdsContext'
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
    // Generate optimized social media image URL using Netlify Image CDN
    const getSocialImageUrl = (headerImage?: string) => {
      if (!headerImage) return undefined

      // Use Netlify Image CDN to optimize for social media (1200x630 is the standard for og:image)
      const netlifyImageUrl = `https://tanstack.com/.netlify/images?url=${encodeURIComponent(
        headerImage,
      )}&w=1200&h=630&fit=cover&fm=jpg&q=80`
      return netlifyImageUrl
    }

    return {
      meta: loaderData
        ? [
            ...seo({
              title: `${loaderData?.title ?? 'Docs'} | TanStack Blog`,
              description: loaderData?.description,
              image: getSocialImageUrl(loaderData?.headerImage),
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

  const blogContent = `<small>_by ${formatAuthors(authors)} on ${format(
    new Date(published || 0),
    'MMM d, yyyy',
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
              <div className="w-full max-w-[1100px] mx-auto">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="w-full flex justify-center">
                    <div className="w-full max-w-[700px] p-2 lg:p-4 xl:p-6">
                      <Breadcrumbs
                        section="Blog"
                        sectionTo="/blog"
                        headings={isTocVisible ? headings : undefined}
                        tocHiddenBreakpoint="md"
                      />
                    </div>
                    <div className="max-w-32 md:max-w-36 xl:max-w-44 2xl:max-w-56 w-full hidden md:block" />
                  </div>
                  <div className="w-full flex justify-center">
                    <div className="flex overflow-auto flex-col w-full max-w-[700px] p-2 lg:p-4 xl:p-6 pt-0">
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
                      <div className="pl-4 max-w-32 md:max-w-36 xl:max-w-44 2xl:max-w-56 w-full hidden md:block py-4">
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
        </div>
        <AdGate>
          <div className="py-2 pb-4 lg:py-4 lg:pb-6 xl:py-6 xl:pb-8 max-w-full">
            <GamHeader />
          </div>
        </AdGate>
      </div>
    </div>
  )
}
