import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/form/$version/docs/')({
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
