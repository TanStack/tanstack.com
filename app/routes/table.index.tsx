import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/table/')({
  loader: () => {
    throw redirect({
      to: '/table/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
