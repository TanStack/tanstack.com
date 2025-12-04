import { Link, createFileRoute } from '@tanstack/react-router'

import { formatAuthors } from '~/utils/blog'
import { Markdown } from '~/components/Markdown'
import { format } from 'date-fns'
import { Footer } from '~/components/Footer'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/react-start'
import { allPosts } from 'content-collections'
import { setResponseHeaders } from '@tanstack/react-start/server'

const fetchFrontMatters = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeaders({
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
      'Netlify-Vary': 'query=payload',
    })

    return allPosts
      .sort((a, b) => {
        return new Date(b.published).getTime() - new Date(a.published).getTime()
      })
      .map((post) => {
        return {
          slug: post.slug,
          title: post.title,
          published: post.published,
          excerpt: post.excerpt,
          authors: post.authors,
        }
      })
  }
)

export const Route = createFileRoute('/_libraries/blog/')({
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
  const frontMatters = Route.useLoaderData()

  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-4xl mx-auto">
        <header className="">
          <h1 className="text-3xl font-black">Blog</h1>
          <p className="text-lg mt-4 text-gray-700 dark:text-gray-300">
            The latest news and blog posts from TanStack
          </p>
        </header>
        <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {frontMatters.map(({ slug, title, published, excerpt, authors }) => {
            return (
              <Link
                key={slug}
                to="/blog/$"
                params={{ _splat: slug }}
                className={`relative flex flex-col gap-4 justify-between
                  border-2 border-transparent rounded-lg p-4 md:p-8
                  transition-all bg-white dark:bg-gray-800
                  shadow-xl dark:shadow-lg dark:shadow-blue-500/30
                  hover:border-blue-500
              `}
              >
                <div>
                  <div className={`text-lg font-extrabold`}>{title}</div>
                  <div className={`text-xs italic font-light mt-1`}>
                    <p>
                      by {formatAuthors(authors)}
                      {published ? (
                        <time
                          dateTime={published}
                          title={format(new Date(published), 'MMM dd, yyyy')}
                        >
                          {' '}
                          on {format(new Date(published), 'MMM dd, yyyy')}
                        </time>
                      ) : null}
                    </p>
                  </div>
                  <div
                    className={`text-sm mt-4 text-black dark:text-white leading-7`}
                  >
                    <Markdown rawContent={excerpt || ''} />
                  </div>
                </div>
                <div>
                  <div className="text-blue-500 uppercase font-black text-sm">
                    Read More
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
      <Footer />
    </div>
  )
}
