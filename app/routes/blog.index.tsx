import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { getPostList } from '~/utils/blog'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import { format } from 'date-fns'
import { Footer } from '~/components/Footer'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import { PostNotFound } from './blog'
import { createServerFn } from '@tanstack/start'

const fetchFrontMatters = createServerFn('GET', async () => {
  'use server'

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
        },
      ] as const
    })
  )

  return frontMatters

  // return json(frontMatters, {
  //   headers: {
  //     'Cache-Control': 'public, max-age=300, s-maxage=3600',
  //   },
  // })
})

export const Route = createFileRoute('/blog/')({
  loader: () => fetchFrontMatters(),
  notFoundComponent: () => <PostNotFound />,
  component: BlogIndex,
  meta: () => [
    {
      title: 'Blog',
    },
  ],
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {frontMatters.map(([id, { title, published, excerpt }]) => {
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
                  {published ? (
                    <div className={`italic font-light mt-2`}>
                      {format(new Date(published), 'MMM dd, yyyy')}
                    </div>
                  ) : null}
                  <div className={`text-sm mt-2 text-black dark:text-white`}>
                    <Markdown
                      components={{
                        a: (props) => <span {...props} />,
                      }}
                      code={excerpt || ''}
                    />
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
        </div>
        <div className="h-24" />
      </div>
      <Footer />
    </div>
  )
}
