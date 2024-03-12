import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/query/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/form/$version/docs/$',
      params: {
        _splat: 'overview',
        version: 'latest',
      },
    })
  },
})
