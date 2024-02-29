import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { seo } from '~/utils/seo'

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
