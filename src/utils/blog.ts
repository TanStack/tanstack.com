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

/**
 * Returns published blog posts (not drafts, not future-dated),
 * sorted by publish date descending (newest first).
 */
export function getPublishedPosts(): Post[] {
  const now = new Date()

  return allPosts
    .filter((post) => !post.draft && new Date(post.published) <= now)
    .sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime(),
    )
}
