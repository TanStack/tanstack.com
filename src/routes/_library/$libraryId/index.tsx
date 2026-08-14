import { redirect, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_library/$libraryId/')({
  beforeLoad: ({ params, location }) => {
    throw redirect({
      href: location.href.replace(
        `/${params.libraryId}`,
        `/${params.libraryId}/latest`,
      ),
      statusCode: 308,
    })
  },
})
