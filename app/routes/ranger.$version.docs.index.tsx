import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/ranger/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/ranger/$version/docs/$',
      params: {
        _splat: 'overview',
        version: 'latest',
      },
    })
  },
})
