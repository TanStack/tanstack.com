export function getPostList() {
  return [
    {
      id: 'announcing-tanstack-form-v1',
    },
    {
      id: 'announcing-tanstack-query-v5',
    },
    {
      id: 'announcing-tanstack-query-v4',
    },
    {
      id: 'ag-grid-partnership',
    },
    {
      id: 'tanstack-router-typescript-performance',
    },
    {
      id: 'why-tanstack-start-is-ditching-adapters',
    },
    {
      id: 'why-tanstack-start-and-router',
    },
  ]
}

export function formatAuthors(authors: Array<string>) {
  if (!authors.length) {
    return 'TanStack'
  }

  if (authors.length === 1) {
    return authors[0]
  }

  if (authors.length === 2) {
    return authors.join(' and ')
  }

  return authors.slice(0, -1).join(', ') + ', and ' + authors.slice(-1)
}
