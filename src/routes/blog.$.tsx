import { createFileRoute } from '@tanstack/react-router'
import { PostNotFound } from './blog'
import * as React from 'react'
import { PlayIcon } from '@phosphor-icons/react'
import { MarkdownContent } from '~/components/markdown'
import { Card } from '~/components/Card'
import { LibrariesWidget } from '~/components/LibrariesWidget'
import { partners } from '~/utils/partners'
import { RightRail } from '~/components/RightRail'
import { PartnerRail } from '~/components/ds/ui/PartnerRail'
import { RecentPostsWidget } from '~/components/RecentPostsWidget'
import { useMediaQuery } from '~/utils/useMediaQuery'

import { Toc } from '~/components/Toc'
import { Breadcrumbs } from '~/components/Breadcrumbs'
import { findMaintainerByAuthorName } from '~/utils/authors'
import { CoverFallback } from '~/components/CoverFallback'
import { fetchBlogPost } from '~/utils/blog.functions'
import { parseSiteMarkdown } from '~/utils/markdown'
import { getBlogPostHead, getBlogSocialImageUrl } from '~/utils/blog-post-seo'

export const Route = createFileRoute('/blog/$')({
  staleTime: Infinity,
  loader: async ({ params }) => {
    const blogPath = params._splat

    if (!blogPath) {
      throw new Error('Invalid blog path')
    }

    return fetchBlogPost({ data: blogPath })
  },
  head: ({ loaderData }) => {
    const socialImage = getBlogSocialImageUrl(loaderData?.headerImage)

    return getBlogPostHead(
      loaderData ? { ...loaderData, socialImage } : undefined,
    )
  },
  notFoundComponent: () => <PostNotFound />,
  component: BlogPost,
})

function BlogPost() {
  const {
    content,
    authors,
    contributors,
    published,
    filePath,
    title,
    headerImage,
    headerVideo,
    headerVideoCaptions,
    library,
  } = Route.useLoaderData()
  const { _splat: slug } = Route.useParams()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [startedVideo, setStartedVideo] = React.useState<string>()
  const hasStartedVideo = startedVideo === headerVideo
  const markdown = React.useMemo(
    () => parseSiteMarkdown(content.replace(/^# [^\n]+\n*/m, '')),
    [content],
  )
  const headings = markdown.headings

  const isTocVisible = headings.length > 1
  const isDesktopViewport = useMediaQuery('(min-width: 768px)')

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
    () => partners.filter((d) => d.status === 'active'),
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
                        tocHiddenBreakpoint="xl"
                      />
                    </div>
                    {isTocVisible && (
                      <div className="pl-4 w-32 lg:w-36 xl:w-44 2xl:w-56 3xl:w-64 shrink-0 hidden xl:block" />
                    )}
                  </div>
                  <div
                    className={[
                      'w-full flex justify-center mx-auto',
                      isTocVisible ? 'max-w-full' : 'max-w-[768px]',
                    ].join(' ')}
                  >
                    <div className="flex overflow-auto flex-col w-full p-2 lg:p-4 xl:p-6 pt-0">
                      <header className="mb-8">
                        <time
                          dateTime={published}
                          className="text-sm text-text-secondary"
                        >
                          {new Intl.DateTimeFormat('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC',
                          }).format(new Date(`${published}T00:00:00Z`))}
                        </time>
                        <h1 className="mt-5 mb-8 text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                          {title}
                        </h1>
                        <div className="flex flex-wrap items-start gap-x-10 gap-y-6 border-b border-gray-500/20 pb-7">
                          <div>
                            <div className="mb-3 text-sm text-text-secondary">
                              Posted by
                            </div>
                            <div className="flex flex-wrap gap-6">
                              {authors.map((name) => {
                                const author = findMaintainerByAuthorName(name)
                                return author ? (
                                  <a
                                    key={name}
                                    href={`https://github.com/${author.github}`}
                                    className="flex items-center gap-3 hover:underline"
                                  >
                                    <img
                                      src={author.avatar}
                                      alt=""
                                      width={44}
                                      height={44}
                                      className="size-11 rounded-full"
                                    />
                                    <div>
                                      <div className="font-semibold">
                                        {name}
                                      </div>
                                      <div className="text-sm text-text-secondary">
                                        @{author.github}
                                      </div>
                                    </div>
                                  </a>
                                ) : (
                                  <span key={name} className="font-semibold">
                                    {name}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                          {contributors.length ? (
                            <div>
                              <div className="mb-3 text-sm text-text-secondary">
                                With contributions from
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex -space-x-3">
                                  {contributors.map((name) => {
                                    const person =
                                      findMaintainerByAuthorName(name)
                                    return person ? (
                                      <a
                                        key={name}
                                        href={`https://github.com/${person.github}`}
                                        aria-label={name}
                                        title={name}
                                        className="relative hover:z-10"
                                      >
                                        <img
                                          src={person.avatar}
                                          alt=""
                                          width={44}
                                          height={44}
                                          className="size-11 rounded-full ring-2 ring-background"
                                        />
                                      </a>
                                    ) : null
                                  })}
                                </div>
                                <div className="text-sm">
                                  {contributors.map((name, index) => {
                                    const person =
                                      findMaintainerByAuthorName(name)
                                    return (
                                      <React.Fragment key={name}>
                                        {index ? ', ' : ''}
                                        {person ? (
                                          <a
                                            href={`https://github.com/${person.github}`}
                                            className="hover:underline"
                                          >
                                            {name}
                                          </a>
                                        ) : (
                                          name
                                        )}
                                      </React.Fragment>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </header>
                      {headerVideo ? (
                        <div className="relative mb-6 overflow-hidden rounded-2xl">
                          <video
                            ref={videoRef}
                            aria-label={title}
                            controls={hasStartedVideo}
                            onPlay={() => setStartedVideo(headerVideo)}
                            playsInline
                            preload="none"
                            poster={headerImage}
                            src={headerVideo}
                            className="aspect-video w-full"
                          >
                            <track
                              kind="captions"
                              src={headerVideoCaptions}
                              srcLang="en"
                              label="English"
                            />
                          </video>
                          {!hasStartedVideo ? (
                            <button
                              type="button"
                              aria-label={`Play ${title} video`}
                              onClick={() => {
                                setStartedVideo(headerVideo)
                                void videoRef.current
                                  ?.play()
                                  .catch(() => setStartedVideo(undefined))
                              }}
                              className="group absolute inset-0 flex items-end justify-end p-4 md:p-6 bg-black/10 transition-colors hover:bg-black/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-500"
                            >
                              <span className="flex size-16 md:size-20 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-xl backdrop-blur-sm transition-transform group-hover:scale-110 group-focus-visible:scale-110">
                                <PlayIcon
                                  weight="fill"
                                  className="ml-1 size-7 md:size-9"
                                  aria-hidden="true"
                                />
                              </span>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {!headerImage && slug ? (
                        <CoverFallback
                          slug={slug}
                          library={library}
                          className="aspect-[5/2] w-full rounded-2xl mb-6"
                        />
                      ) : null}
                      <MarkdownContent
                        title=""
                        markdown={markdown}
                        preserveTabPanels
                        repo={repo}
                        branch={branch}
                        filePath={filePath}
                        containerRef={markdownContainerRef}
                        eagerFirstImage
                      />
                    </div>
                    {isTocVisible && (
                      <div className="pl-4 w-32 lg:w-36 xl:w-44 2xl:w-56 3xl:w-64 shrink-0 hidden xl:block py-4 transition-all">
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
          <RightRail breakpoint="md" className="md:w-[220px]">
            <PartnerRail
              analyticsPlacement="blog_rail"
              partners={activePartners}
            />
            <div className="hidden md:block border border-gray-500/20 rounded-l-lg overflow-hidden w-full">
              <RecentPostsWidget enabled={isDesktopViewport} />
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
