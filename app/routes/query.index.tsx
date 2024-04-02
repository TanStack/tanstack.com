import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/query/')({
  loader: () => {
    throw redirect({
      to: '/query/$version',
      params: {
        version: 'latest',
      },
    })
  },
})
