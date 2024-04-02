import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/router/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/router/$version/docs/framework/$framework',
      params: {
        version: 'latest',
        framework: 'react',
      },
    })
  },
})
