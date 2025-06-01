import { Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setHeaders } from '@tanstack/react-start/server'
import { DocTitle } from '~/components/DocTitle'
import { Footer } from '~/components/Footer'
import { Markdown } from '~/components/Markdown'
import { formatAuthors } from '~/utils/blog'
import { allPosts } from 'content-collections'
import { format } from 'date-fns'
import { PostNotFound } from './blog'

const fetchFrontMatters = createServerFn({ method: 'GET' }).handler(
  async () => {
    setHeaders({
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

    // return json(frontMatters, {
    //   headers: {
    //     'Cache-Control': 'public, max-age=300, s-maxage=3600',
    //   },
    // })
  },
)

export const Route = createFileRoute({
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
    <div>
      <div className="min-h-screen p-4 lg:p-6">
        <div>
          <DocTitle>Blog</DocTitle>
          <div className="h-6" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {frontMatters.map(({ slug, title, published, excerpt, authors }) => {
            return (
              <Link
                key={slug}
                to="/blog/$"
                params={{ _splat: slug }}
                className={`flex flex-col justify-between gap-4 rounded-lg border-2 border-transparent bg-white/100 p-4 shadow-xl transition-all hover:border-blue-500 md:p-8 dark:bg-gray-800 dark:shadow-lg dark:shadow-blue-500/30`}
              >
                <div>
                  <div className={`text-lg font-extrabold`}>{title}</div>
                  <div className={`mt-1 text-xs font-light italic`}>
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
                    className={`mt-4 text-sm leading-7 text-black dark:text-white`}
                  >
                    <Markdown rawContent={excerpt || ''} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-black text-blue-500 uppercase">
                    Read More
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        <div className="h-24" />
      </div>
      <Footer />
    </div>
  )
}
