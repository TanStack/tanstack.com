import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/builder_/p/$hash')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/chat/p/$hash',
      params: { hash: params.hash },
      replace: true,
      reloadDocument: true,
    })
  },
})
