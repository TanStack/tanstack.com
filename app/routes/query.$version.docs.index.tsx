import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/query/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/query/$version/docs/framework/$framework/$',
      params: {
        version: 'latest',
        framework: 'react',
        _splat: 'overview',
      },
    })
  },
})
