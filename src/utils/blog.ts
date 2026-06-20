import { allPosts, type Post } from 'content-collections'
import { matchSorter } from 'match-sorter'
import { findLibrary, type LibraryId, type LibrarySlim } from '~/libraries'

const listJoiner = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction',
})

const authorAliases = new Map<string, string>([
  ['TkDodo', 'Dominik Dorfmeister'],
])

export function normalizeBlogAuthor(author: string) {
  return authorAliases.get(author) ?? author
}

export function normalizeBlogAuthors(authors: Array<string>) {
  const normalizedAuthors: Array<string> = []
  const seen = new Set<string>()

  for (const author of authors) {
    const normalizedAuthor = normalizeBlogAuthor(author)

    if (!seen.has(normalizedAuthor)) {
      seen.add(normalizedAuthor)
      normalizedAuthors.push(normalizedAuthor)
    }
  }

  return normalizedAuthors
}

export function formatAuthors(authors: Array<string>) {
  const normalizedAuthors = normalizeBlogAuthors(authors)

  if (!normalizedAuthors.length) {
    return 'TanStack'
  }

  return listJoiner.format(normalizedAuthors)
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

export type BlogCardPost = {
  slug: string
  title: string
  published: string
  excerpt: string
  headerImage: string | undefined
  authors: Array<string>
  library: string | undefined
  externalUrl?: string
  source?: string
}

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

export function isBlogCardPostForLibrary(
  post: BlogCardPost,
  libraryId: LibraryId,
) {
  return getBlogLibraries(post.library).some((lib) => lib.id === libraryId)
}

export function getDistinctAuthors(
  posts: ReadonlyArray<{ authors: string[] }>,
): string[] {
  const authors = new Set<string>()
  for (const post of posts) {
    for (const author of post.authors) {
      authors.add(normalizeBlogAuthor(author))
    }
  }
  return [...authors].sort((a, b) => a.localeCompare(b))
}

export function searchBlogCardPosts(
  posts: Array<BlogCardPost>,
  query: string | undefined,
) {
  const trimmedQuery = query?.trim()

  if (!trimmedQuery) {
    return posts
  }

  return matchSorter(posts, trimmedQuery, {
    keys: [
      'title',
      'excerpt',
      (post) => post.authors.join(' '),
      (post) =>
        getBlogLibraries(post.library)
          .map((library) => `${library.id} ${library.name}`)
          .join(' '),
      (post) => post.library ?? '',
    ],
  })
}
