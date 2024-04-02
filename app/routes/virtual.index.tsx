import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/virtual/')({
  loader: () => {
    throw redirect({
      to: '/virtual/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
