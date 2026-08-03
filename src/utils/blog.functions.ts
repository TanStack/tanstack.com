import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { allPosts } from 'content-collections'
import * as v from 'valibot'
import { findLibrary, type LibraryId } from '~/libraries'
import {
  getPostsForLibrary,
  getVisiblePosts,
  postToBlogCardPost,
  sortBlogCardPosts,
} from '~/utils/blog'
import {
  type BlogCardPost,
  formatAuthors,
  formatPublishedDate,
  getBlogLibraries,
  isPublishedDateReleased,
} from '~/utils/blog-format'
import { getExternalBlogPosts } from '~/utils/external-blog-posts.server'
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

function setExistingBlogListResponseHeaders() {
  setResponseHeaders(
    new Headers({
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Cloudflare-CDN-Cache-Control':
        'public, max-age=300, stale-while-revalidate=300',
    }),
  )
}

function getInternalBlogCardPosts() {
  return sortBlogCardPosts(getVisiblePosts().map(postToBlogCardPost))
}

async function getBlogCardPosts(options?: { libraryId?: LibraryId }) {
  const externalPosts = await getExternalBlogPosts(options)

  return sortBlogCardPosts([...getInternalBlogCardPosts(), ...externalPosts])
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
        'Cloudflare-CDN-Cache-Control':
          'public, max-age=300, stale-while-revalidate=300',
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

export const fetchBlogIndexPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<BlogCardPost>> => {
    setExistingBlogListResponseHeaders()
    return getBlogCardPosts()
  },
)

export const fetchBlogPostsForLibrary = createServerFn({ method: 'GET' })
  .validator(v.string())
  .handler(async ({ data }): Promise<Array<BlogCardPost>> => {
    const library = findLibrary(data)

    if (!library) {
      return []
    }

    return (await getBlogCardPosts({ libraryId: library.id })).filter((post) =>
      getBlogLibraries(post.library).some(
        (postLibrary) => postLibrary.id === library.id,
      ),
    )
  })

export const fetchRecentPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<RecentPost>> => {
    setExistingBlogListResponseHeaders()

    return getInternalBlogCardPosts()
      .slice(0, 3)
      .map((post) => ({
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

export type RelatedPost = {
  libraryId: LibraryId
  post: {
    slug: string
    title: string
    published: string
    excerpt: string
  }
}

/**
 * Mirrors CategoryArticle's original client-side
 * `libraries.flatMap((lib) => getPostsForLibrary(lib.id)...).slice(0, 4)`
 * so the display order/cutoff of related posts is unchanged.
 */
export const fetchRelatedPostsForLibraries = createServerFn({ method: 'GET' })
  .validator(v.array(v.string()))
  .handler(({ data }): Array<RelatedPost> => {
    return (data as Array<LibraryId>)
      .flatMap((libraryId) =>
        getPostsForLibrary(libraryId).map((post) => ({
          libraryId,
          post: {
            slug: post.slug,
            title: post.title,
            published: post.published,
            excerpt: post.excerpt,
          },
        })),
      )
      .slice(0, 4)
  })
