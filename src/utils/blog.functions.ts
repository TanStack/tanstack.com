import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { notFound, redirect } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import * as v from 'valibot'
import {
  formatAuthors,
  formatPublishedDate,
  getPublishedPosts,
  isPublishedDateReleased,
} from '~/utils/blog'
import { buildRedirectManifest } from './redirects'

export type RecentPost = {
  slug: string
  title: string
  published: string
  excerpt: string
  headerImage: string | undefined
  authors: Array<string>
}

const blogRedirectManifest = buildRedirectManifest(
  allPosts.flatMap((post) =>
    (post.redirectFrom ?? []).map((redirectFrom: string) => ({
      from: normalizeBlogRedirectPath(redirectFrom),
      to: post.slug,
      source: post._meta.filePath,
    })),
  ),
  {
    label: 'blog posts',
    formatTarget: (target) => `/blog/${target}`,
  },
)

function normalizeBlogRedirectPath(path: string) {
  return path.replace(/^\/+|\/+$/g, '')
}

function handleRedirects(blogPath: string) {
  const normalizedPaths = new Set([
    normalizeBlogRedirectPath(blogPath),
    normalizeBlogRedirectPath(`/blog/${blogPath}`),
  ])

  for (const path of normalizedPaths) {
    const redirectedPostSlug = blogRedirectManifest[path]

    if (redirectedPostSlug) {
      throw redirect({
        href: `/blog/${redirectedPostSlug}`,
        statusCode: 308,
      })
    }
  }

  if (blogPath.includes('directives-the-new-framework-lock-in')) {
    throw redirect({
      href: '/blog/directives-and-the-platform-boundary',
    })
  }
}

export const fetchBlogPost = createServerFn({ method: 'GET' })
  .validator(v.optional(v.string()))
  .handler(async ({ data }: { data: string | undefined }) => {
    if (!data) {
      throw new Error('Invalid blog path')
    }

    handleRedirects(data)

    const post = allPosts.find((candidate) => candidate.slug === data)

    if (!post) {
      throw notFound()
    }

    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
      }),
    )

    const blogContent = `<small><em>by ${formatAuthors(post.authors)} on ${formatPublishedDate(
      post.published || '1970-01-01',
    )}.</em></small>

${post.content}`

    const isUnpublished = post.draft || !isPublishedDateReleased(post.published)

    return {
      authors: post.authors,
      content: blogContent,
      description: post.excerpt,
      filePath: `src/blog/${data}.md`,
      headerImage: post.headerImage,
      isUnpublished,
      library: post.library,
      published: post.published,
      title: post.title,
    }
  })

export const fetchRecentPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<RecentPost>> => {
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
      }),
    )

    return getPublishedPosts()
      .slice(0, 3)
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        published: post.published,
        excerpt: post.excerpt,
        headerImage: post.headerImage,
        authors: post.authors,
      }))
  },
)
