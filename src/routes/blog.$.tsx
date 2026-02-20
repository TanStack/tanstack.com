import { notFound, redirect, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { PostNotFound } from './blog'
import { formatAuthors } from '~/utils/blog'
import { allPosts } from 'content-collections'
import * as React from 'react'
import { GamHeader } from '~/components/Gam'
import { AdGate } from '~/contexts/AdsContext'
import { Toc } from '~/components/Toc'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { DocTitle } from '~/components/DocTitle'
import { CopyPageDropdown } from '~/components/CopyPageDropdown'
import { Button } from '~/ui'
import { SquarePen } from 'lucide-react'
import { loadBlogPost } from '~/utils/renderBlogContent'

function handleRedirects(docsPath: string) {
  if (docsPath.includes('directives-the-new-framework-lock-in')) {
    throw redirect({
      href: '/blog/directives-and-the-platform-boundary',
    })
  }
}

export const Route = createFileRoute('/blog/$')({
  staleTime: Infinity,
  loader: async ({ params }) => {
    const slug = params._splat
    if (!slug) {
      throw new Error('Invalid docs path')
    }

    handleRedirects(slug)

    // Check if post exists before calling server function
    const post = allPosts.find((p) => p.slug === slug)
    if (!post) {
      throw notFound()
    }

    return loadBlogPost({ data: { slug } })
  },
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
  const { headings, ContentRsc, title, filePath } = Route.useLoaderData()

  const repo = 'tanstack/tanstack.com'
  const branch = 'main'

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
                    <div
                      ref={markdownContainerRef}
                      className="flex overflow-auto flex-col w-full max-w-[700px] p-2 lg:p-4 xl:p-6 pt-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <DocTitle>{title}</DocTitle>
                        <div className="flex items-center gap-2 shrink-0">
                          <CopyPageDropdown
                            repo={repo}
                            branch={branch}
                            filePath={filePath}
                          />
                        </div>
                      </div>
                      <div className="h-4" />
                      <div className="h-px bg-gray-500 opacity-20" />
                      <div className="h-4" />
                      {ContentRsc}
                      <div className="h-12" />
                      <div className="w-full h-px bg-gray-500 opacity-30" />
                      <div className="flex py-4">
                        <Button
                          variant="ghost"
                          size="xs"
                          as="a"
                          href={`https://github.com/${repo}/edit/${branch}/${filePath}`}
                        >
                          <SquarePen className="w-3.5 h-3.5" />
                          Edit on GitHub
                        </Button>
                      </div>
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
