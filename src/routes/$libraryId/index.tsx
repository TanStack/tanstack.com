import { createFileRoute } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$libraryId/')({
  beforeLoad: ({ params }) => {
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
