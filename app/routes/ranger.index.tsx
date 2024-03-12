import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/ranger/')({
  loader: () => {
    throw redirect({
      to: '/ranger/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
