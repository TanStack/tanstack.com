import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/table/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/table/$version/docs/framework/$framework',
      params: {
        version: 'latest',
        framework: 'react',
      },
    })
  },
})
