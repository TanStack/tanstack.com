import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/start/')({
  loader: () => {
    throw redirect({
      to: '/start/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
