import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/form/')({
  loader: () => {
    throw redirect({
      to: '/form/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
