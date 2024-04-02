import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/config/')({
  loader: () => {
    throw redirect({
      to: '/config/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
