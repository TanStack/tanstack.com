import { allPosts, type Post } from 'content-collections'

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
