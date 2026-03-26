import { Link, createFileRoute } from '@tanstack/react-router'
import { Card } from '~/components/Card'
import {
  formatAuthors,
  formatPublishedDate,
  getPublishedPosts,
} from '~/utils/blog'

import { Footer } from '~/components/Footer'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { RssIcon } from 'lucide-react'
import { LibrariesWidget } from '~/components/LibrariesWidget'
import { partners } from '~/utils/partners'
import { PartnersRail, RightRail } from '~/components/RightRail'
import { RecentPostsWidget } from '~/components/RecentPostsWidget'
import { seo } from '~/utils/seo'

type BlogFrontMatter = {
  slug: string
  title: string
  published: string
  excerpt: string
  headerImage: string | undefined
  authors: string[]
}

const fetchFrontMatters = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=300',
      }),
    )

    return getPublishedPosts().map((post) => {
      return {
        slug: post.slug,
        title: post.title,
        published: post.published,
        excerpt: post.excerpt,
        headerImage: post.headerImage,
        authors: post.authors,
      }
    })

    // return json(frontMatters, {
    //   headers: {
    //     'Cache-Control': 'public, max-age=300, s-maxage=3600',
    //   },
    // })
  },
)

export const Route = createFileRoute('/blog/')({
  staleTime: Infinity,
  loader: () => fetchFrontMatters(),
  notFoundComponent: () => <PostNotFound />,
  component: BlogIndex,
  head: () => ({
    meta: seo({
      title: 'Blog | TanStack',
      description: 'The latest news and blog posts from TanStack.',
    }),
  }),
})

function BlogIndex() {
  const frontMatters = Route.useLoaderData() as BlogFrontMatter[]
  const activePartners = partners.filter(
    (d) =>
      d.status === 'active' && d.name !== 'Nozzle.io' && d.id !== 'fireship',
  )

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 w-full max-w-[1400px] mx-auto">
        <div className="flex gap-8 items-start">
          <div className="flex-1 space-y-12 min-w-0">
            <header className="">
              <div className="flex gap-3 items-baseline">
                <h1 className="text-3xl font-black">Blog</h1>
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors text-xl"
                  title="RSS Feed"
                >
                  <RssIcon />
                </a>
              </div>

              <p className="text-lg mt-4 text-gray-600 dark:text-gray-400">
                The latest news and blog posts from TanStack
              </p>
            </header>
            <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {frontMatters.map(
                ({ slug, title, published, excerpt, headerImage, authors }) => {
                  return (
                    <Card
                      key={slug}
                      as={Link}
                      to="/blog/$"
                      params={{ _splat: slug } as never}
                      className="relative flex flex-col justify-between overflow-hidden transition-all hover:shadow-sm hover:border-blue-500"
                    >
                      {headerImage ? (
                        <div className="aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
                          <img
                            src={headerImage}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="p-4 md:p-8 flex flex-col gap-4 flex-1 justify-between">
                        <div>
                          <div className="text-lg font-extrabold">{title}</div>
                          <div className="text-xs italic font-light mt-1">
                            by {formatAuthors(authors)}
                            {published ? (
                              <time
                                dateTime={published}
                                title={formatPublishedDate(published)}
                              >
                                {' '}
                                on {formatPublishedDate(published)}
                              </time>
                            ) : null}
                          </div>
                          {excerpt ? (
                            <p className="text-sm mt-4 text-gray-600 dark:text-gray-400 leading-7 line-clamp-4">
                              {excerpt}
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <div className="text-blue-500 uppercase font-black text-sm">
                            Read More
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                },
              )}
            </section>
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
      <Footer />
    </div>
  )
}
