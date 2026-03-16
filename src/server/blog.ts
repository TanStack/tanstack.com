import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { getPublishedPosts } from '~/utils/blog'

export type RecentPost = {
  slug: string
  title: string
  published: string
  excerpt: string | undefined
  authors: Array<string>
}

export const fetchRecentPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<RecentPost>> => {
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=300',
      }),
    )

    return getPublishedPosts()
      .slice(0, 3)
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        published: post.published,
        excerpt: post.excerpt,
        authors: post.authors,
      }))
  },
)
