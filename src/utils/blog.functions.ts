import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { notFound, redirect } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import * as v from 'valibot'
import { findLibrary } from '~/libraries'
import {
  type BlogCardPost,
  formatAuthors,
  formatPublishedDate,
  getPublishedPosts,
  isBlogCardPostForLibrary,
  isPublishedDateReleased,
  normalizeBlogAuthors,
  postToBlogCardPost,
  sortBlogCardPosts,
} from '~/utils/blog'
import { getExternalBlogPosts } from '~/utils/external-blog-posts.server'
import { renderMarkdownToRsc } from './markdown'
import { buildRedirectManifest } from './redirects'

export type RecentPost = Pick<
  BlogCardPost,
  | 'slug'
  | 'title'
  | 'published'
  | 'excerpt'
  | 'headerImage'
  | 'authors'
  | 'externalUrl'
  | 'source'
>

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

function setBlogListCacheHeaders() {
  setResponseHeaders(
    new Headers({
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control':
        'public, max-age=3600, durable, stale-while-revalidate=3600',
      'Netlify-CDN-Cache-Control':
        'public, max-age=3600, durable, stale-while-revalidate=3600',
    }),
  )
}

async function getBlogCardPosts() {
  const [externalPosts] = await Promise.all([getExternalBlogPosts()])

  return sortBlogCardPosts([
    ...getPublishedPosts().map(postToBlogCardPost),
    ...externalPosts,
  ])
}

export const fetchBlogPost = createServerFn({ method: 'GET' })
  .inputValidator(v.optional(v.string()))
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
        'Netlify-CDN-Cache-Control':
          'public, max-age=300, durable, stale-while-revalidate=300',
      }),
    )

    const blogContent = `<small>_by ${formatAuthors(post.authors)} on ${formatPublishedDate(
      post.published || '1970-01-01',
    )}._</small>

${post.content}`

    const { contentRsc, headings } = await renderMarkdownToRsc(blogContent, {
      preserveTabPanels: true,
    })
    const isUnpublished = post.draft || !isPublishedDateReleased(post.published)
    const authors = normalizeBlogAuthors(post.authors)

    return {
      authors,
      contentRsc,
      description: post.excerpt,
      filePath: `src/blog/${data}.md`,
      headings,
      headerImage: post.headerImage,
      isUnpublished,
      library: post.library,
      published: post.published,
      title: post.title,
    }
  })

export const fetchBlogIndexPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<BlogCardPost>> => {
    setBlogListCacheHeaders()
    return getBlogCardPosts()
  },
)

export const fetchBlogPostsForLibrary = createServerFn({ method: 'GET' })
  .inputValidator(v.string())
  .handler(async ({ data }): Promise<Array<BlogCardPost>> => {
    setBlogListCacheHeaders()

    const library = findLibrary(data)

    if (!library) {
      return []
    }

    return (await getBlogCardPosts()).filter((post) =>
      isBlogCardPostForLibrary(post, library.id),
    )
  })

export const fetchRecentPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<RecentPost>> => {
    setBlogListCacheHeaders()

    return (await getBlogCardPosts()).slice(0, 3).map((post) => ({
      slug: post.slug,
      title: post.title,
      published: post.published,
      excerpt: post.excerpt,
      headerImage: post.headerImage,
      authors: post.authors,
      externalUrl: post.externalUrl,
      source: post.source,
    }))
  },
)
