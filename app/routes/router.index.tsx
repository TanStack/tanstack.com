import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/router/')({
  loader: () => {
    throw redirect({
      to: '/router/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
