const joiner = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction',
})

export function formatAuthors(authors: Array<string>) {
  if (!authors.length) {
    return 'TanStack'
  }

  return joiner.format(authors)
}
