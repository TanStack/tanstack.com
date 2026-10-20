import { redirect, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_library/$libraryId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      href: `/${params.libraryId}/latest`,
    })
  },
})
