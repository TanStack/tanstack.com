import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/store/')({
  loader: () => {
    throw redirect({
      to: '/store/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
