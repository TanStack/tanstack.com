import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/builder_/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/chat/project/$projectId',
      params: { projectId: params.id },
      replace: true,
      reloadDocument: true,
    })
  },
})
