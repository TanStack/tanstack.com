import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/store/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      from: '/store/$version/docs/',
      to: '/store/$version/docs/$',
      params: {
        _splat: 'overview',
      },
    })
  },
})
