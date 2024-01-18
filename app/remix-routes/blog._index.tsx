import * as React from 'react'
import { useLoaderData, Link } from '@remix-run/react'
import { json } from '@remix-run/node'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import { getPostList } from '~/utils/blog'
import { DocTitle } from '~/components/DocTitle'
import { RenderMarkdown } from '~/components/RenderMarkdown'
import { format } from 'date-fns'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { Footer } from '~/components/Footer'

export const loader = async () => {
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
        throw new Response('Not Found', {
          status: 404,
        })
      }

      const frontMatter = extractFrontMatter(file)

      return [
        info.id,
        {
          title: frontMatter.data.title,
          published: frontMatter.data.published,
          excerpt: frontMatter.excerpt,
        },
      ]
    })
  )

  return json(frontMatters)
}

export const ErrorBoundary = DefaultErrorBoundary

export default function RouteReactTableDocs() {
  const frontMatters = useLoaderData<typeof loader>() as [
    string,
    { title: string; published: string; excerpt: string }
  ][]

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
                    <RenderMarkdown
                      components={{
                        a: (props) => <span {...props} />,
                      }}
                    >
                      {excerpt}
                    </RenderMarkdown>
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
