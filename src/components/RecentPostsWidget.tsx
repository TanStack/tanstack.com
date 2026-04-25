import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchRecentPosts } from '~/utils/blog.functions'
import { formatPublishedDate } from '~/utils/blog'
import { Suspense } from 'react'

function RecentPostsList() {
  const { data: posts } = useSuspenseQuery({
    queryKey: ['recentPosts'],
    queryFn: () => fetchRecentPosts(),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-500/20 px-3 py-2">
        <Link
          to="/blog"
          className="font-medium opacity-60 hover:opacity-100 text-xs"
        >
          Latest Posts
        </Link>
      </div>
      <div className="flex flex-col divide-y divide-gray-500/10">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to="/blog/$"
            params={{ _splat: post.slug } as never}
            className="flex flex-col gap-0.5 px-3 py-2.5
              hover:bg-gray-500/5 transition-colors duration-150"
          >
            <span className="text-xs font-medium leading-snug line-clamp-2">
              {post.title}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-500">
              {formatPublishedDate(post.published)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function RecentPostsWidget() {
  return (
    <Suspense>
      <RecentPostsList />
    </Suspense>
  )
}
