import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { formatAuthors, getPostList } from '~/utils/blog'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import { format } from 'date-fns'
import { Footer } from '~/components/Footer'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/start'

const fetchFrontMatters = createServerFn({ method: 'GET' }).handler(
  async () => {
    const postInfos = getPostList()

    const frontMatters = await Promise.all(
      postInfos.map(async (info) => {
        const filePath = `app/blog/${info.id}.md`

        const file = await fetchRepoFile(
          'tanstack/tanstack.com',
          'main',
          filePath
        )

        if (!file) {
          throw notFound()
        }

        const frontMatter = extractFrontMatter(file)

        return [
          info.id,
          {
            title: frontMatter.data.title,
            published: frontMatter.data.published,
            excerpt: frontMatter.excerpt,
            authors: frontMatter.data.authors as Array<string> | undefined,
          },
        ] as const
      })
    )

    return frontMatters.sort((a, b) => {
      if (!a[1].published) {
        return 1
      }

      return (
        new Date(b[1].published || 0).getTime() -
        new Date(a[1].published || 0).getTime()
      )
    })

    // return json(frontMatters, {
    //   headers: {
    //     'Cache-Control': 'public, max-age=300, s-maxage=3600',
    //   },
    // })
  }
)

export const Route = createFileRoute('/blog/')({
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
      <div className="p-4 lg:p-6 min-h-screen">
        <div>
          <DocTitle>Latest Posts</DocTitle>
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {frontMatters.map(
            ([id, { title, published, excerpt, authors = [] }]) => {
              return (
                <Link
                  key={id}
                  to={`${id}`}
                  className={`flex flex-col gap-4 justify-between
                  border-2 border-transparent rounded-lg p-4 md:p-8
                  transition-all bg-white dark:bg-gray-800
                  shadow-xl dark:shadow-lg dark:shadow-blue-500/30
                  hover:border-blue-500
              `}
                >
                  <div>
                    <div className={`text-lg font-extrabold`}>{title}</div>
                    <div className={`italic font-light mt-2`}>
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
                      className={`text-sm mt-2 text-black dark:text-white leading-7`}
                    >
                      <Markdown code={excerpt || ''} />
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-500 uppercase font-black text-sm">
                      Read More
                    </div>
                  </div>
                </Link>
              )
            }
          )}
        </div>
        <div className="h-24" />
      </div>
      <Footer />
    </div>
  )
}
