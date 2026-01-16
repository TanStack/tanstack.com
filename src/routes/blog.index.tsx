import { Link, createFileRoute } from '@tanstack/react-router'
import { Card } from '~/components/Card'
import { formatAuthors, getPublishedPosts } from '~/utils/blog'
import { SimpleMarkdown } from '~/components/SimpleMarkdown'
import { format } from '~/utils/dates'
import { Footer } from '~/components/Footer'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { RssIcon } from 'lucide-react'

type BlogFrontMatter = {
  slug: string
  title: string
  published: string
  excerpt: string | undefined
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
    meta: [
      {
        title: 'Blog',
      },
    ],
  }),
})

function BlogIndex() {
  const frontMatters = Route.useLoaderData() as BlogFrontMatter[]

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-4xl mx-auto">
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
          {frontMatters.map(({ slug, title, published, excerpt, authors }) => {
            return (
              <Card
                key={slug}
                as={Link}
                to="/blog/$"
                params={{ _splat: slug } as never}
                className="relative flex flex-col gap-4 justify-between p-4 md:p-8 transition-all hover:shadow-sm hover:border-blue-500"
              >
                <div>
                  <div className={`text-lg font-extrabold`}>{title}</div>
                  <div className={`text-xs italic font-light mt-1`}>
                    <p>
                      by {formatAuthors(authors)}
                      {published ? (
                        <time
                          dateTime={published}
                          title={format(new Date(published), 'MMM d, yyyy')}
                        >
                          {' '}
                          on {format(new Date(published), 'MMM d, yyyy')}
                        </time>
                      ) : null}
                    </p>
                  </div>
                  <div
                    className={`text-sm mt-4 text-black dark:text-white leading-7`}
                  >
                    <SimpleMarkdown rawContent={excerpt || ''} />
                  </div>
                </div>
                <div>
                  <div className="text-blue-500 uppercase font-black text-sm">
                    Read More
                  </div>
                </div>
              </Card>
            )
          })}
        </section>
      </div>
      <Footer />
    </div>
  )
}
