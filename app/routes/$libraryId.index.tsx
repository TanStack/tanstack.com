import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$libraryId/')({
  loader: ({ params }) => {
    throw redirect({
      to: '/$libraryId/$version',
      params: (prev) => ({
        ...prev,
        libraryId: params.libraryId,
        version: 'latest',
      }),
    })
  },
})
