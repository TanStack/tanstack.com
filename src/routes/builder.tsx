import { createFileRoute, Outlet } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/builder')({
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
  component: () => <Outlet />,
})
