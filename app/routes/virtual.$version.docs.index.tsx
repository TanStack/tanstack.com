import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/virtual/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/virtual/$version/docs/framework/$framework',
      params: {
        version: 'latest',
        framework: 'react',
      },
    })
  },
})
