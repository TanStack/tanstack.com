import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { seo } from '~/utils/seo'

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
