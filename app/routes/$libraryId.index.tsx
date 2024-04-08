import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$libraryId/')({
  loader: () => {
    throw redirect({
      to: '/$libraryId/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
