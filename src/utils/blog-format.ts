import { matchSorter } from 'match-sorter'
import { findLibrary, type LibrarySlim } from '~/libraries'
import { SITE_URL } from '~/utils/site'

const listJoiner = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction',
})

const authorAliases = new Map<string, string>([
  ['TkDodo', 'Dominik Dorfmeister'],
])

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

export type BlogAuthorIdentity = {
  type: 'Organization' | 'Person'
  name: string
  url?: string
}

type BlogAuthorProfile = {
  name: string
  github: string
}

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

export function getBlogAuthorIdentities(
  authors: Array<string>,
  profiles: ReadonlyArray<BlogAuthorProfile>,
): Array<BlogAuthorIdentity> {
  const normalizedAuthors = normalizeBlogAuthors(authors)

  if (!normalizedAuthors.length) {
    return [
      {
        type: 'Organization',
        name: 'TanStack',
        url: `${SITE_URL}/`,
      },
    ]
  }

  return normalizedAuthors.map((name) => {
    const profile = profiles.find((candidate) => candidate.name === name)

    return {
      type: 'Person',
      name,
      ...(profile ? { url: `https://github.com/${profile.github}` } : {}),
    }
  })
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

export function isPublishedDateReleased(published: string) {
  return published <= getUtcDateString(new Date())
}

export function isBlogPostUnpublished(post: {
  draft?: boolean
  published: string
}) {
  return Boolean(post.draft) || !isPublishedDateReleased(post.published)
}

export function publishedDateToUTCString(published: string) {
  return parsePublishedDate(published).toUTCString()
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
