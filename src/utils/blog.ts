import { allPosts, type Post } from 'content-collections'
import type { LibraryId } from '~/libraries'
import { getBlogLibraries, isPublishedDateReleased } from './blog-format'

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
