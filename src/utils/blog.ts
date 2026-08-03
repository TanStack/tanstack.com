import { allPosts, type Post } from 'content-collections'
import type { LibraryId } from '~/libraries'
import {
  getBlogLibraries,
  isPublishedDateReleased,
  normalizeBlogAuthors,
  type BlogCardPost,
} from './blog-format'

export type { BlogCardPost } from './blog-format'

export function postToBlogCardPost(post: Post): BlogCardPost {
  return {
    slug: post.slug,
    title: post.title,
    published: post.published,
    excerpt: post.excerpt,
    headerImage: post.headerImage,
    authors: normalizeBlogAuthors(post.authors),
    library: post.library,
  }
}

export function sortBlogCardPosts(posts: Array<BlogCardPost>) {
  return [...posts].sort(
    (a, b) =>
      b.published.localeCompare(a.published) ||
      a.title.localeCompare(b.title) ||
      a.slug.localeCompare(b.slug),
  )
}

/**
 * Returns published blog posts (not drafts, not future-dated),
 * sorted by publish date descending (newest first).
 */
export function getPublishedPosts(): Post[] {
  return allPosts
    .filter((post) => !post.draft && isPublishedDateReleased(post.published))
    .sort((a, b) => b.published.localeCompare(a.published))
}

export function getVisiblePosts(): Post[] {
  if (import.meta.env.DEV) {
    return [...allPosts].sort((a, b) => b.published.localeCompare(a.published))
  }

  return getPublishedPosts()
}

export function getPostsForLibrary(libraryId: LibraryId): Post[] {
  return getVisiblePosts().filter((post) =>
    getBlogLibraries(post.library).some((lib) => lib.id === libraryId),
  )
}
