import * as React from 'react'
import { json, Link, LoaderFunction, useLoaderData } from 'remix'
import {
  Doc,
  DocFrontMatter,
  fetchRepoFrontMatter,
  fetchRepoMarkdown,
} from '~/utils/docCache.server'
import { getPostList } from '~/utils/blog'
import { FaEdit } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Mdx } from '~/components/Mdx'
import { format } from 'date-fns'

export const loader: LoaderFunction = async (context) => {
  const postInfos = getPostList()
  const frontMatters = await Promise.all(
    postInfos.map(async (info) => {
      const frontMatter = await fetchRepoFrontMatter(
        'tanstack',
        'main',
        `app/blog/${info.id}.md`,
        process.env.NODE_ENV === 'development'
      )

      return [info.id, frontMatter]
    })
  )

  return json(frontMatters)
}

export default function RouteReactTableDocs() {
  const frontMatters = useLoaderData() as [string, DocFrontMatter][]

  console.log(frontMatters)

  return (
    <div className="p-4 lg:p-6">
      <div>
        <DocTitle>Latest Posts</DocTitle>
        <div className="h-4" />
        <div className="h-px bg-gray-500 opacity-20" />
        <div className="h-4" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {frontMatters.map(([id, { title, published, exerpt }]) => {
          return (
            <Link
              to={`${id}`}
              className={`border-2 border-transparent rounded-lg p-4 md:p-8
              transition-all bg-white dark:bg-gray-900
              shadow-xl dark:shadow-lg dark:shadow-blue-500/30
              hover:border-blue-500
              `}
            >
              <div className={`text-lg font-extrabold `}>{title}</div>
              {published ? (
                <div className={`italic font-light mt-2`}>
                  {format(new Date(published), 'MMM dd, yyyy')}
                </div>
              ) : null}
              <div className={`text-sm mt-2 text-black dark:text-white`}>
                {exerpt}...
              </div>
              <div className="h-4" />
              <div className="text-blue-500 uppercase font-black text-sm">
                Read More
              </div>
            </Link>
          )
        })}
      </div>
      <div className="h-24" />
    </div>
  )
}
