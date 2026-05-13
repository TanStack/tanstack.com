import { allPosts, type Post } from 'content-collections'
import { findLibrary, type LibraryId, type LibrarySlim } from '~/libraries'

const listJoiner = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction',
})

export function formatAuthors(authors: Array<string>) {
  if (!authors.length) {
    return 'TanStack'
  }

  return listJoiner.format(authors)
}

function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function parsePublishedDate(published: string) {
  const [year, month, day] = published.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day, 12))
}

export function formatPublishedDate(published: string) {
  return parsePublishedDate(published).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function isPublishedDateReleased(published: string, now = new Date()) {
  return published <= getUtcDateString(now)
}

export function publishedDateToUTCString(published: string) {
  return parsePublishedDate(published).toUTCString()
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

function isLibrarySlim(
  library: LibrarySlim | undefined,
): library is LibrarySlim {
  return library !== undefined
}

export function getBlogLibraries(library: string | undefined): LibrarySlim[] {
  if (!library) {
    return []
  }

  return library
    .split(',')
    .map((libraryId) => findLibrary(libraryId.trim()))
    .filter(isLibrarySlim)
}

export function getPostsForLibrary(libraryId: LibraryId): Post[] {
  return getPublishedPosts().filter((post) =>
    getBlogLibraries(post.library).some((lib) => lib.id === libraryId),
  )
}

export function getDistinctAuthors(
  posts: ReadonlyArray<{ authors: string[] }>,
): string[] {
  const authors = new Set<string>()
  for (const post of posts) {
    for (const author of post.authors) {
      authors.add(author)
    }
  }
  return [...authors].sort((a, b) => a.localeCompare(b))
}
